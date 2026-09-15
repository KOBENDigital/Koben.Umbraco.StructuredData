using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services.Navigation;
using Umbraco.Cms.Core.Strings;
using Umbraco.Extensions;

namespace Koben.Umbraco.StructuredData.Rules;

/// <summary>
/// Binding vocabulary (the <c>source</c> member of a binding object):
/// <list type="bullet">
/// <item><c>property</c> — <c>alias</c> read from the document (dot paths walk into picked content:
/// <c>author.name</c>); <c>fallbackAliases</c>; <c>scope: "site"</c> reads the root document;
/// <c>format: "name"</c> turns picked content into names instead of URLs.</item>
/// <item><c>value</c> — a literal JSON <c>value</c>, with optional per-culture overrides in
/// <c>cultureValues</c> keyed by ISO code.</item>
/// <item><c>dictionary</c> — the Umbraco dictionary item <c>key</c>, in the request culture.</item>
/// <item><c>url</c>, <c>name</c>, <c>createDate</c>, <c>updateDate</c> — the document's own.</item>
/// <item><c>breadcrumb</c> — a ListItem array from the root to the document.</item>
/// <item><c>children</c> — a ListItem array of published children.</item>
/// <item><c>ref</c> — <c>{"@id": …}</c> for <c>target</c> organization | website | webpage.</item>
/// <item><c>id</c> — the same identifier as a string, for an <c>@id</c> member.</item>
/// <item><c>entity</c> — a nested object with its own <c>@type</c> and <c>fields</c>.</item>
/// <item><c>list</c> — an array of the bindings in <c>items</c>.</item>
/// </list>
/// </summary>
public sealed partial class StructuredDataRuleEvaluator(
    IPublishedValueFallback publishedValueFallback,
    IDocumentNavigationQueryService navigationQueryService,
    IPublishedContentCache contentCache,
    IPublishedUrlProvider urlProvider,
    IVariationContextAccessor variationContextAccessor,
    StructuredDataDictionaryCache dictionary,
    ILogger<StructuredDataRuleEvaluator> logger) : IStructuredDataRuleEvaluator
{
    private const string FieldsKey = "fields";
    private const string TypeKey = "@type";

    /// <inheritdoc />
    public JsonObject? Evaluate(StructuredDataRule rule, IPublishedContent content)
    {
        if (rule.Definition[TypeKey] is not JsonValue typeValue || typeValue.GetValueKind() != JsonValueKind.String)
        {
            return null;
        }

        var node = new JsonObject { [TypeKey] = typeValue.GetValue<string>() };
        ApplyFields(node, rule.Definition[FieldsKey] as JsonObject, content);
        return node;
    }

    private void ApplyFields(JsonObject target, JsonObject? fields, IPublishedContent content)
    {
        if (fields is null)
        {
            return;
        }

        foreach (KeyValuePair<string, JsonNode?> pair in fields)
        {
            if (pair.Value is not JsonObject binding)
            {
                continue;
            }

            JsonNode? value = Bind(binding, content);
            if (value is not null)
            {
                target[pair.Key] = value;
            }
        }
    }

    private JsonNode? Bind(JsonObject binding, IPublishedContent content)
    {
        string source = binding["source"]?.GetValue<string>() ?? string.Empty;
        switch (source)
        {
            case "property":
                return BindProperty(binding, content);
            case "value":
                return BindValue(binding);
            case "dictionary":
                return BindDictionary(binding);
            case "url":
                return DocumentReference(content.Key);
            case "name":
                return JsonValue.Create(NameOf(content));
            case "createDate":
                return JsonValue.Create(FormatDate(content.CreateDate));
            case "updateDate":
                return JsonValue.Create(FormatDate(content.UpdateDate));
            case "breadcrumb":
                return ListItems(Ancestors(content).Append(content));
            case "children":
                return ListItems(Children(content));
            case "ref":
                return IdentifierFor(binding, content) is { } reference ? new JsonObject { ["@id"] = reference } : null;
            case "id":
                return IdentifierFor(binding, content);
            case "entity":
            {
                if (binding[TypeKey] is not JsonValue typeValue)
                {
                    return null;
                }

                var entity = new JsonObject { [TypeKey] = typeValue.GetValue<string>() };
                ApplyFields(entity, binding[FieldsKey] as JsonObject, content);
                return entity;
            }

            case "list":
            {
                if (binding["items"] is not JsonArray items)
                {
                    return null;
                }

                var list = new JsonArray();
                foreach (JsonNode? item in items)
                {
                    if (item is JsonObject itemBinding && Bind(itemBinding, content) is { } bound)
                    {
                        list.Add(bound);
                    }
                }

                return list.Count == 0 ? null : list;
            }

            default:
                return null;
        }
    }

    /// <summary>The request culture, or null when the request is invariant.</summary>
    private string? Culture
    {
        get
        {
            string? culture = variationContextAccessor.VariationContext?.Culture;
            return string.IsNullOrWhiteSpace(culture) ? null : culture;
        }
    }

    /// <summary>A literal, with a per-culture override when one matches the request culture.</summary>
    private JsonNode? BindValue(JsonObject binding)
    {
        if (Culture is { } culture && binding["cultureValues"] is JsonObject cultureValues)
        {
            KeyValuePair<string, JsonNode?> match = cultureValues.FirstOrDefault(pair => string.Equals(pair.Key, culture, StringComparison.OrdinalIgnoreCase));
            if (match.Value is not null && !(match.Value is JsonValue scalar && scalar.TryGetValue(out string? text) && string.IsNullOrWhiteSpace(text)))
            {
                return match.Value.DeepClone();
            }
        }

        return binding["value"]?.DeepClone();
    }

    private JsonNode? BindDictionary(JsonObject binding)
    {
        string? key = binding["key"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
        }

        string? text = dictionary.Translate(key, Culture);
        return string.IsNullOrWhiteSpace(text) ? null : JsonValue.Create(text);
    }

    /// <summary>The document's name in the request culture when it varies, otherwise its invariant name.</summary>
    private string? NameOf(IPublishedContent content)
    {
        if (Culture is { } culture && content.Cultures.TryGetValue(culture, out PublishedCultureInfo? info) && !string.IsNullOrWhiteSpace(info.Name))
        {
            return info.Name;
        }

        return content.Name;
    }

    private JsonNode? BindProperty(JsonObject binding, IPublishedContent content)
    {
        IPublishedContent subject = string.Equals(binding["scope"]?.GetValue<string>(), "site", StringComparison.OrdinalIgnoreCase)
            ? Root(content)
            : content;
        string format = binding["format"]?.GetValue<string>() ?? "auto";

        var aliases = new List<string>();
        if (binding["alias"]?.GetValue<string>() is { Length: > 0 } alias)
        {
            aliases.Add(alias);
        }

        if (binding["fallbackAliases"] is JsonArray fallbacks)
        {
            aliases.AddRange(fallbacks.Select(entry => entry?.GetValue<string>()).Where(entry => !string.IsNullOrWhiteSpace(entry))!);
        }

        foreach (string path in aliases)
        {
            try
            {
                // A blank string or an empty list is "nothing here", so the next alias gets its turn;
                // a text box converter answers "" for an untouched field, not null.
                JsonNode? value = ToJson(ReadPath(subject, path), format);
                if (value is not null && !IsBlank(value))
                {
                    return value;
                }
            }
            catch (Exception exception)
            {
                // A property whose converter throws must not take the other bindings with it.
                logger.LogWarning(exception, "Structured data binding could not read {Path} on {ContentKey}; trying the next alias.", path, subject.Key);
            }
        }

        logger.LogDebug("Structured data binding {Aliases} produced nothing on {ContentKey} ({ContentType}).", string.Join(", ", aliases), subject.Key, subject.ContentType.Alias);
        return null;
    }

    /// <summary>Walks a dot path; a picked-content list narrows to its first item when the path continues.</summary>
    private object? ReadPath(IPublishedContent subject, string path)
    {
        object? current = subject;
        foreach (string segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (current is IEnumerable<IPublishedContent> many && current is not IPublishedContent)
            {
                current = many.FirstOrDefault();
            }

            if (current is not IPublishedContent item)
            {
                return null;
            }

            current = segment switch
            {
                "name" => NameOf(item),
                "url" => item,
                "key" => item.Key.ToString(),
                "createDate" => item.CreateDate,
                "updateDate" => item.UpdateDate,
                _ => ReadProperty(item, segment),
            };
        }

        return current;
    }

    /// <summary>
    /// The converted value, or — when a converter yields nothing for a value that is plainly there —
    /// the stored source value for simple text and numbers, so a page never loses a title to a
    /// converter quirk.
    /// </summary>
    private object? ReadProperty(IPublishedContent item, string alias)
    {
        IPublishedProperty? property = item.GetProperty(alias);
        if (property is null)
        {
            return null;
        }

        object? converted = item.Value(publishedValueFallback, alias, Culture);
        if (converted is not null)
        {
            return converted;
        }

        object? source = property.GetSourceValue();
        logger.LogDebug(
            "Structured data binding {Alias} on {ContentKey}: converted value is null (HasValue={HasValue}, source={SourceType}).",
            alias,
            item.Key,
            property.HasValue(),
            source?.GetType().Name ?? "null");

        return source is string or int or long or decimal or double ? source : null;
    }

    /// <summary>Turns a converted Umbraco value into JSON-LD-shaped JSON with reference placeholders.</summary>
    private JsonNode? ToJson(object? value, string format)
    {
        switch (value)
        {
            case null:
                return null;
            case string text:
                return JsonValue.Create(text);
            case IHtmlEncodedString html:
                return JsonValue.Create(StripTags(html.ToHtmlString() ?? string.Empty));
            case bool flag:
                return JsonValue.Create(flag);
            case int or long or decimal or double or float:
                return JsonValue.Create(Convert.ToDouble(value));
            case DateTime date:
                return JsonValue.Create(FormatDate(date));
            case DateTimeOffset offset:
                return JsonValue.Create(offset.ToString("yyyy-MM-dd'T'HH:mm:ssK"));
            case IPublishedContent picked:
                return picked.ItemType == PublishedItemType.Media
                    ? MediaReference(picked.Key, format)
                    : format == "name"
                        ? JsonValue.Create(NameOf(picked))
                        : DocumentReference(picked.Key);
            case Link link:
                return link.Udi is GuidUdi udi && udi.EntityType == Constants.UdiEntityType.Document
                    ? DocumentReference(udi.Guid)
                    : string.IsNullOrWhiteSpace(link.Url) ? null : JsonValue.Create(link.Url);
            case JsonNode node:
                return node.DeepClone();
            case IEnumerable<object?> items:
            {
                var array = new JsonArray();
                foreach (object? item in items)
                {
                    if (ToJson(item, format) is { } member)
                    {
                        array.Add(member);
                    }
                }

                return array.Count == 0 ? null : array;
            }

            default:
                return JsonValue.Create(value.ToString());
        }
    }

    private JsonNode? IdentifierFor(JsonObject binding, IPublishedContent content)
    {
        string target = binding["target"]?.GetValue<string>() ?? "organization";
        return target switch
        {
            "webpage" => DocumentReference(content.Key, "webpage"),
            "website" => DocumentReference(Root(content).Key, "website"),
            "organization" => DocumentReference(Root(content).Key, "organization"),
            _ => null,
        };
    }

    /// <summary>
    /// One ListItem per distinct URL. A container that shares its URL with the page below it (a site
    /// root over its home page) yields to that page, which carries the name a visitor would expect.
    /// </summary>
    private JsonArray? ListItems(IEnumerable<IPublishedContent> items)
    {
        var distinct = new List<IPublishedContent>();
        var urls = new List<string>();
        foreach (IPublishedContent item in items)
        {
            string url = urlProvider.GetUrl(item, UrlMode.Relative);
            if (string.IsNullOrEmpty(url) || url == "#")
            {
                continue;
            }

            int existing = urls.IndexOf(url);
            if (existing >= 0)
            {
                distinct[existing] = item;
                continue;
            }

            distinct.Add(item);
            urls.Add(url);
        }

        if (distinct.Count == 0)
        {
            return null;
        }

        var list = new JsonArray();
        int position = 1;
        foreach (IPublishedContent item in distinct)
        {
            list.Add(new JsonObject
            {
                [TypeKey] = "ListItem",
                ["position"] = position++,
                ["name"] = NameOf(item),
                ["item"] = DocumentReference(item.Key),
            });
        }

        return list;
    }

    /// <summary>Ancestors from the root down, excluding the document itself.</summary>
    private IEnumerable<IPublishedContent> Ancestors(IPublishedContent content)
    {
        if (!navigationQueryService.TryGetAncestorsKeys(content.Key, out IEnumerable<Guid> keys))
        {
            return [];
        }

        return keys
            .Select(key => contentCache.GetById(key))
            .Where(ancestor => ancestor is not null)
            .Select(ancestor => ancestor!)
            .OrderBy(ancestor => ancestor.Level)
            .ToList();
    }

    /// <summary>Published children in tree order; the non-preview cache lookup drops unpublished ones.</summary>
    private IEnumerable<IPublishedContent> Children(IPublishedContent content)
    {
        if (!navigationQueryService.TryGetChildrenKeys(content.Key, out IEnumerable<Guid> keys))
        {
            return [];
        }

        return keys
            .Select(key => contentCache.GetById(key))
            .Where(child => child is not null)
            .Select(child => child!)
            .ToList();
    }

    private IPublishedContent Root(IPublishedContent content) => Ancestors(content).FirstOrDefault() ?? content;

    private static JsonObject DocumentReference(Guid key, string? fragment = null)
    {
        var reference = new JsonObject
        {
            [StructuredDataConstants.Reference.Key] = StructuredDataConstants.Reference.Document,
            [StructuredDataConstants.Reference.Target] = key.ToString(),
        };

        if (fragment is not null)
        {
            reference[StructuredDataConstants.Reference.Fragment] = fragment;
        }

        return reference;
    }

    private static JsonObject MediaReference(Guid key, string format)
    {
        var reference = new JsonObject
        {
            [StructuredDataConstants.Reference.Key] = StructuredDataConstants.Reference.Media,
            [StructuredDataConstants.Reference.Target] = key.ToString(),
        };

        if (format == "url")
        {
            reference[StructuredDataConstants.Reference.Shape] = StructuredDataConstants.Reference.UrlShape;
        }

        return reference;
    }

    private static bool IsBlank(JsonNode value) => value switch
    {
        JsonValue scalar => scalar.TryGetValue(out string? text) && string.IsNullOrWhiteSpace(text),
        JsonArray array => array.Count == 0,
        _ => false,
    };

    /// <summary>Midnight dates read as dates; anything else keeps its time.</summary>
    private static string FormatDate(DateTime date) =>
        date.TimeOfDay == TimeSpan.Zero ? date.ToString("yyyy-MM-dd") : date.ToString("yyyy-MM-dd'T'HH:mm:ss");

    private static string StripTags(string html) => TagPattern().Replace(html, " ").Replace("&nbsp;", " ").Trim();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex TagPattern();
}
