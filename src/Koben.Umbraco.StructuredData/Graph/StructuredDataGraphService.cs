using System.Text.Json;
using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Models;
using Koben.Umbraco.StructuredData.Persistence;
using Koben.Umbraco.StructuredData.Resolution;
using Koben.Umbraco.StructuredData.Rules;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;
using Umbraco.Cms.Core.Services.Navigation;

namespace Koben.Umbraco.StructuredData.Graph;

/// <inheritdoc />
public sealed class StructuredDataGraphService(
    IStructuredDataRuleRepository repository,
    StructuredDataRuleCache cache,
    IStructuredDataRuleEvaluator evaluator,
    IStructuredDataResolver resolver,
    IDocumentNavigationQueryService navigationQueryService,
    IPublishedContentCache contentCache,
    IVariationContextAccessor variationContextAccessor,
    ILogger<StructuredDataGraphService> logger) : IStructuredDataGraphService
{
    private const string TypeKey = "@type";

    /// <summary>Types that stand in for one another as "the organisation", so only one is emitted.</summary>
    private static readonly HashSet<string> OrganizationTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Organization", "LocalBusiness", "ProfessionalService", "Store", "Restaurant", "MedicalBusiness",
        "FinancialService", "HomeAndConstructionBusiness", "Corporation",
    };

    private static readonly JsonSerializerOptions ParseOptions = new() { PropertyNameCaseInsensitive = true };

    /// <inheritdoc />
    public IReadOnlyList<JsonObject> Build(IPublishedContent content, StructuredDataUrlMode urlMode, bool preview)
    {
        IPublishedContent root = Root(content, preview);
        string? culture = variationContextAccessor.VariationContext?.Culture;
        IReadOnlyList<StructuredDataRule> rules = cache.GetEnabled(repository.GetAll)
            .Where(rule => rule.AppliesToSite(root.Key, PublishedContentCompat.Name(root)) && rule.AppliesToCulture(culture))
            .ToList();

        var layers = new List<IReadOnlyList<JsonObject>>
        {
            Generated(rules.Where(rule => rule.Scope == StructuredDataRuleScope.Site), content, urlMode, preview),
            Generated(rules.Where(rule => rule.Scope == StructuredDataRuleScope.DocumentTypes && rule.AppliesTo(content.ContentType.Alias)), content, urlMode, preview),
            root.Key == content.Key ? [] : Authored(root, urlMode, preview),
            Authored(content, urlMode, preview),
        };

        return Merge(layers);
    }

    /// <inheritdoc />
    public StructuredDataModel BuildModel(IPublishedContent content, bool preview = false)
    {
        IReadOnlyList<JsonObject> nodes = Build(content, StructuredDataUrlMode.Website, preview);
        return nodes.Count == 0 ? StructuredDataModel.Empty : new StructuredDataModel(nodes);
    }

    /// <inheritdoc />
    public IReadOnlyList<JsonObject> Preview(StructuredDataRule rule, IPublishedContent content, StructuredDataUrlMode urlMode)
        => Generated([rule], content, urlMode, preview: true);

    private IReadOnlyList<JsonObject> Generated(IEnumerable<StructuredDataRule> rules, IPublishedContent content, StructuredDataUrlMode urlMode, bool preview)
    {
        var value = new StructuredDataValue();
        foreach (StructuredDataRule rule in rules)
        {
            try
            {
                if (evaluator.Evaluate(rule, content) is { } node)
                {
                    value.Items.Add(new StructuredDataItem { Key = rule.Key.ToString(), Type = rule.SchemaType, Enabled = true, Node = node });
                }
            }
            catch (Exception exception)
            {
                // One broken rule must not take a page's whole graph, or the page, down with it.
                logger.LogWarning(exception, "Structured data rule {RuleName} ({RuleKey}) failed on {ContentKey} and was skipped.", rule.Name, rule.Key, content.Key);
            }
        }

        return resolver.Resolve(value, urlMode, preview);
    }

    /// <summary>Every Structured Data property on the document, resolved from its stored value.</summary>
    private IReadOnlyList<JsonObject> Authored(IPublishedContent content, StructuredDataUrlMode urlMode, bool preview)
    {
        var nodes = new List<JsonObject>();
        foreach (IPublishedProperty property in content.Properties)
        {
            if (!property.PropertyType.EditorAlias.Equals(StructuredDataConstants.SchemaAlias, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (property.GetSourceValue() is not string json || string.IsNullOrWhiteSpace(json))
            {
                continue;
            }

            try
            {
                StructuredDataValue? value = JsonSerializer.Deserialize<StructuredDataValue>(json, ParseOptions);
                nodes.AddRange(resolver.Resolve(value, urlMode, preview));
            }
            catch (JsonException exception)
            {
                logger.LogWarning(exception, "Structured data on {ContentKey}/{PropertyAlias} is not readable and was skipped.", content.Key, property.Alias);
            }
        }

        return nodes;
    }

    /// <summary>
    /// Later layers win: a node removes any earlier node of the same type, and any organisation-like
    /// type removes every earlier organisation-like node, so a page never emits two organisations.
    /// </summary>
    private static IReadOnlyList<JsonObject> Merge(IReadOnlyList<IReadOnlyList<JsonObject>> layers)
    {
        var result = new List<JsonObject>();
        foreach (IReadOnlyList<JsonObject> layer in layers)
        {
            var types = layer.Select(PrimaryType).ToHashSet(StringComparer.OrdinalIgnoreCase);
            bool hasOrganization = types.Any(OrganizationTypes.Contains);
            result.RemoveAll(existing =>
            {
                string type = PrimaryType(existing);
                return types.Contains(type) || (hasOrganization && OrganizationTypes.Contains(type));
            });
            result.AddRange(layer);
        }

        return result;
    }

    private static string PrimaryType(JsonObject node) => node[TypeKey] switch
    {
        JsonValue value => value.ToString(),
        JsonArray array => array.FirstOrDefault()?.ToString() ?? string.Empty,
        _ => string.Empty,
    };

    private IPublishedContent Root(IPublishedContent content, bool preview)
    {
        if (!navigationQueryService.TryGetAncestorsKeys(content.Key, out IEnumerable<Guid> keys))
        {
            return content;
        }

        IPublishedContent? root = keys
            .Select(key => contentCache.GetById(preview, key))
            .Where(ancestor => ancestor is not null)
            .OrderBy(ancestor => ancestor!.Level)
            .FirstOrDefault();

        return root ?? content;
    }
}
