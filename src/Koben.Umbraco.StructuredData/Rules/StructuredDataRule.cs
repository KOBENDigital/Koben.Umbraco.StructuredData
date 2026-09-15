using System.Text.Json.Nodes;

namespace Koben.Umbraco.StructuredData.Rules;

/// <summary>Where a generation rule applies.</summary>
public enum StructuredDataRuleScope
{
    /// <summary>Every published document.</summary>
    Site,

    /// <summary>Documents of the listed content type aliases only.</summary>
    DocumentTypes,
}

/// <summary>A site root a rule is limited to. Matched by key, then by name so exports survive environments where keys differ.</summary>
public sealed class StructuredDataRuleSite
{
    /// <summary>The root document's key.</summary>
    public Guid Key { get; set; }

    /// <summary>The root document's name, as a fallback match.</summary>
    public string? Name { get; set; }
}

/// <summary>
/// A structured data generation rule: a schema.org entity built from a document's own values at
/// read time, so editors do not have to author it on every page.
/// </summary>
public sealed class StructuredDataRule
{
    /// <summary>Stable identity, assigned on creation.</summary>
    public Guid Key { get; set; }

    /// <summary>Editor-facing name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Disabled rules are kept but never evaluated.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Evaluation order; lower runs first.</summary>
    public int SortOrder { get; set; }

    /// <summary>Whether the rule is site-wide or bound to document types.</summary>
    public StructuredDataRuleScope Scope { get; set; }

    /// <summary>Content type aliases the rule applies to when scoped to document types.</summary>
    public List<string> DocumentTypeAliases { get; set; } = [];

    /// <summary>Site roots the rule is limited to; empty means every site.</summary>
    public List<StructuredDataRuleSite> Sites { get; set; } = [];

    /// <summary>Culture ISO codes the rule is limited to; empty means every culture.</summary>
    public List<string> Cultures { get; set; } = [];

    /// <summary>
    /// The template: <c>{"@type": "...", "fields": { property: binding, … }}</c>. Bindings are
    /// evaluated by <see cref="IStructuredDataRuleEvaluator"/>.
    /// </summary>
    public JsonObject Definition { get; set; } = new();

    /// <summary>The <c>@type</c> the rule emits, read from the definition.</summary>
    public string? SchemaType => Definition["@type"]?.GetValue<string>();

    /// <summary>True when the rule applies under the given site root.</summary>
    /// <param name="rootKey">The root document's key.</param>
    /// <param name="rootName">The root document's name.</param>
    public bool AppliesToSite(Guid rootKey, string? rootName) =>
        Sites.Count == 0
        || Sites.Any(site => site.Key == rootKey)
        || Sites.Any(site => !string.IsNullOrWhiteSpace(site.Name) && string.Equals(site.Name, rootName, StringComparison.OrdinalIgnoreCase));

    /// <summary>True when the rule applies for the request culture (an invariant request matches every rule).</summary>
    /// <param name="culture">The request culture ISO code, or null/empty when invariant.</param>
    public bool AppliesToCulture(string? culture) =>
        Cultures.Count == 0
        || string.IsNullOrWhiteSpace(culture)
        || Cultures.Any(entry => string.Equals(entry, culture, StringComparison.OrdinalIgnoreCase));

    /// <summary>True when the rule applies to a document of the given content type alias.</summary>
    /// <param name="contentTypeAlias">The document's content type alias.</param>
    public bool AppliesTo(string contentTypeAlias) =>
        Scope == StructuredDataRuleScope.Site
        || DocumentTypeAliases.Any(alias => string.Equals(alias, contentTypeAlias, StringComparison.OrdinalIgnoreCase));
}
