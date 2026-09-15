using System.Text.Json;
using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Models;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.DeliveryApi;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Routing;
using Umbraco.Extensions;

namespace Koben.Umbraco.StructuredData.Resolution;

/// <inheritdoc />
public sealed class StructuredDataResolver(
    IPublishedContentCache contentCache,
    IPublishedMediaCache mediaCache,
    IPublishedUrlProvider urlProvider,
    IApiContentRouteBuilder apiContentRouteBuilder,
    IApiMediaUrlProvider apiMediaUrlProvider,
    IVariationContextAccessor variationContextAccessor,
    ILogger<StructuredDataResolver> logger) : IStructuredDataResolver
{
    private const string TypeKey = "@type";
    private const string ContextKey = "@context";
    private const string IdKey = "@id";

    /// <inheritdoc />
    public IReadOnlyList<JsonObject> Resolve(StructuredDataValue? value, StructuredDataUrlMode urlMode, bool preview)
    {
        if (value?.Items is not { Count: > 0 } items)
        {
            return [];
        }

        var nodes = new List<JsonObject>(items.Count);
        foreach (StructuredDataItem item in items)
        {
            if (!item.Enabled || item.Node is null)
            {
                continue;
            }

            if (ResolveNode(item.Node.DeepClone(), urlMode, preview) is not JsonObject resolved)
            {
                continue;
            }

            if (!resolved.ContainsKey(TypeKey))
            {
                logger.LogDebug("Structured data entry {Key} has no @type and was skipped.", item.Key);
                continue;
            }

            // @context first, so the emitted document reads the way people expect JSON-LD to.
            resolved.Remove(ContextKey);
            var ordered = new JsonObject { [ContextKey] = StructuredDataConstants.SchemaOrgContext };
            foreach (KeyValuePair<string, JsonNode?> pair in resolved.ToList())
            {
                resolved.Remove(pair.Key);
                ordered[pair.Key] = pair.Value;
            }

            nodes.Add(ordered);
        }

        return nodes;
    }

    /// <summary>
    /// Resolves one subtree. Returns null when the subtree carries nothing worth emitting.
    /// </summary>
    private JsonNode? ResolveNode(JsonNode? node, StructuredDataUrlMode urlMode, bool preview)
    {
        switch (node)
        {
            case null:
                return null;

            case JsonObject obj when IsReference(obj):
                return ResolveReference(obj, urlMode, preview);

            case JsonObject obj:
                return ResolveObject(obj, urlMode, preview);

            case JsonArray array:
                return ResolveArray(array, urlMode, preview);

            case JsonValue scalar:
                return ResolveScalar(scalar);

            default:
                return null;
        }
    }

    /// <summary>Resolves every member and drops an entity left with nothing but its type or id.</summary>
    private JsonObject? ResolveObject(JsonObject obj, StructuredDataUrlMode urlMode, bool preview)
    {
        foreach (string key in obj.Select(pair => pair.Key).ToList())
        {
            JsonNode? resolved = ResolveNode(obj[key], urlMode, preview);
            if (resolved is null)
            {
                obj.Remove(key);
            }
            else
            {
                obj[key] = resolved;
            }
        }

        bool hasContent = obj.Any(pair => pair.Key is not (TypeKey or ContextKey));
        return hasContent ? obj : null;
    }

    /// <summary>Resolves members in order and drops the array when none survive.</summary>
    private JsonArray? ResolveArray(JsonArray array, StructuredDataUrlMode urlMode, bool preview)
    {
        var kept = new List<JsonNode>();
        foreach (JsonNode? member in array.ToList())
        {
            array.Remove(member!);
            if (ResolveNode(member, urlMode, preview) is { } resolved)
            {
                kept.Add(resolved);
            }
        }

        if (kept.Count == 0)
        {
            return null;
        }

        var result = new JsonArray();
        foreach (JsonNode member in kept)
        {
            result.Add(member);
        }

        return result;
    }

    /// <summary>Trims strings and drops blanks; numbers and booleans pass through unchanged.</summary>
    private static JsonNode? ResolveScalar(JsonValue scalar)
    {
        if (scalar.TryGetValue(out string? text))
        {
            string trimmed = text.Trim();
            return trimmed.Length == 0 ? null : JsonValue.Create(trimmed);
        }

        return scalar.GetValueKind() is JsonValueKind.Null ? null : scalar.DeepClone();
    }

    private static bool IsReference(JsonObject obj) =>
        obj.TryGetPropertyValue(StructuredDataConstants.Reference.Key, out JsonNode? kind)
        && kind is JsonValue;

    /// <summary>
    /// Replaces a placeholder with what it points at. An unresolvable reference (deleted media,
    /// unpublished page) is dropped rather than emitted as a dangling id.
    /// </summary>
    private JsonNode? ResolveReference(JsonObject reference, StructuredDataUrlMode urlMode, bool preview)
    {
        string? kind = reference[StructuredDataConstants.Reference.Key]?.GetValue<string>();
        string? target = reference[StructuredDataConstants.Reference.Target]?.GetValue<string>();
        string? shape = reference[StructuredDataConstants.Reference.Shape]?.GetValue<string>();
        string? fragment = reference[StructuredDataConstants.Reference.Fragment]?.GetValue<string>();

        if (!Guid.TryParse(target, out Guid key))
        {
            return null;
        }

        return kind switch
        {
            StructuredDataConstants.Reference.Media => ResolveMedia(key, shape, urlMode),
            StructuredDataConstants.Reference.Document => ResolveDocument(key, urlMode, preview, fragment),
            _ => null,
        };
    }

    private JsonNode? ResolveMedia(Guid key, string? shape, StructuredDataUrlMode urlMode)
    {
        IPublishedContent? media = mediaCache.GetById(key);
        if (media is null)
        {
            return null;
        }

        string url = urlMode == StructuredDataUrlMode.DeliveryApi
            ? apiMediaUrlProvider.GetUrl(media)
            : media.MediaUrl(urlProvider, mode: UrlMode.Absolute);

        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        if (string.Equals(shape, StructuredDataConstants.Reference.UrlShape, StringComparison.OrdinalIgnoreCase))
        {
            return JsonValue.Create(url);
        }

        var image = new JsonObject
        {
            [TypeKey] = "ImageObject",
            ["url"] = url,
        };

        int width = media.Value<int>(Constants.Conventions.Media.Width);
        int height = media.Value<int>(Constants.Conventions.Media.Height);
        if (width > 0 && height > 0)
        {
            image["width"] = width;
            image["height"] = height;
        }

        return image;
    }

    private string? UrlFor(IPublishedContent content, StructuredDataUrlMode urlMode, string? culture) =>
        urlMode == StructuredDataUrlMode.DeliveryApi
            ? apiContentRouteBuilder.Build(content, culture)?.Path
            : urlProvider.GetUrl(content, UrlMode.Absolute, culture);

    private JsonNode? ResolveDocument(Guid key, StructuredDataUrlMode urlMode, bool preview, string? fragment)
    {
        IPublishedContent? content = contentCache.GetById(preview, key);
        if (content is null)
        {
            return null;
        }

        // The request culture, so a page links to its URL in the language being served.
        string? culture = variationContextAccessor.VariationContext?.Culture;
        culture = string.IsNullOrWhiteSpace(culture) ? null : culture;

        string? url = UrlFor(content, urlMode, culture);
        if (culture is not null && (string.IsNullOrWhiteSpace(url) || url == "#"))
        {
            // Invariant content has no per-culture route; its one URL serves every language.
            url = UrlFor(content, urlMode, null);
        }

        if (string.IsNullOrWhiteSpace(url) || url == "#")
        {
            return null;
        }

        return JsonValue.Create(string.IsNullOrEmpty(fragment) ? url : $"{url}#{fragment}");
    }
}
