using System.Text.Json;
using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Rules;

namespace Koben.Umbraco.StructuredData.ViewModels;

/// <summary>A generation rule as the Management API and the export file carry it.</summary>
public sealed class StructuredDataRuleModel
{
    /// <summary>Serializer settings shared by the API models and the seed file.</summary>
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    /// <summary>Stable identity; omitted on create.</summary>
    public Guid? Key { get; set; }

    /// <summary>Editor-facing name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether the rule is evaluated.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Evaluation order; lower runs first.</summary>
    public int SortOrder { get; set; }

    /// <summary>Where the rule applies: <c>site</c> or <c>documentTypes</c>.</summary>
    public string Scope { get; set; } = "site";

    /// <summary>Content type aliases, for <see cref="StructuredDataRuleScope.DocumentTypes"/>.</summary>
    public List<string> DocumentTypeAliases { get; set; } = [];

    /// <summary>Site roots the rule is limited to; empty means every site.</summary>
    public List<StructuredDataRuleSiteModel> Sites { get; set; } = [];

    /// <summary>Culture ISO codes the rule is limited to; empty means every culture.</summary>
    public List<string> Cultures { get; set; } = [];

    /// <summary>The template: <c>@type</c> plus field bindings.</summary>
    public JsonObject Definition { get; set; } = new();

    private bool IsDocumentTypeScope => string.Equals(Scope, "documentTypes", StringComparison.OrdinalIgnoreCase);

    /// <summary>Maps to the domain model, assigning a key when the model has none.</summary>
    public StructuredDataRule ToRule() => new()
    {
        Key = Key ?? Guid.NewGuid(),
        Name = Name.Trim(),
        Enabled = Enabled,
        SortOrder = SortOrder,
        Scope = IsDocumentTypeScope ? StructuredDataRuleScope.DocumentTypes : StructuredDataRuleScope.Site,
        DocumentTypeAliases = DocumentTypeAliases.Where(alias => !string.IsNullOrWhiteSpace(alias)).Select(alias => alias.Trim()).Distinct().ToList(),
        Sites = Sites.Where(site => site.Key != Guid.Empty).Select(site => new StructuredDataRuleSite { Key = site.Key, Name = site.Name }).ToList(),
        Cultures = Cultures.Where(culture => !string.IsNullOrWhiteSpace(culture)).Select(culture => culture.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList(),
        Definition = (JsonObject)Definition.DeepClone(),
    };

    /// <summary>Maps from the domain model.</summary>
    public static StructuredDataRuleModel FromRule(StructuredDataRule rule) => new()
    {
        Key = rule.Key,
        Name = rule.Name,
        Enabled = rule.Enabled,
        SortOrder = rule.SortOrder,
        Scope = rule.Scope == StructuredDataRuleScope.DocumentTypes ? "documentTypes" : "site",
        DocumentTypeAliases = [.. rule.DocumentTypeAliases],
        Sites = rule.Sites.Select(site => new StructuredDataRuleSiteModel { Key = site.Key, Name = site.Name }).ToList(),
        Cultures = [.. rule.Cultures],
        Definition = (JsonObject)rule.Definition.DeepClone(),
    };

    /// <summary>Names the problem with the model, or null when it is storable.</summary>
    public string? Validate()
    {
        if (string.IsNullOrWhiteSpace(Name))
        {
            return "A rule needs a name.";
        }

        if (Definition["@type"] is not JsonValue type || string.IsNullOrWhiteSpace(type.ToString()))
        {
            return "The definition needs an @type.";
        }

        if (IsDocumentTypeScope && !DocumentTypeAliases.Any(alias => !string.IsNullOrWhiteSpace(alias)))
        {
            return "A rule scoped to document types needs at least one document type alias.";
        }

        return null;
    }
}

/// <summary>A site root reference on a rule.</summary>
public sealed class StructuredDataRuleSiteModel
{
    /// <summary>The root document's key.</summary>
    public Guid Key { get; set; }

    /// <summary>The root document's name, kept for display and as a cross-environment fallback match.</summary>
    public string? Name { get; set; }
}

/// <summary>A site root available for targeting, with the hostnames attached to it.</summary>
public sealed class StructuredDataSiteModel
{
    /// <summary>The root document's key.</summary>
    public Guid Key { get; set; }

    /// <summary>The root document's name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Hostnames assigned in Culture and Hostnames, with their culture.</summary>
    public List<StructuredDataDomainModel> Domains { get; set; } = [];
}

/// <summary>One hostname assignment.</summary>
public sealed class StructuredDataDomainModel
{
    /// <summary>The hostname, as entered.</summary>
    public string DomainName { get; set; } = string.Empty;

    /// <summary>The culture the hostname serves.</summary>
    public string? Culture { get; set; }
}

/// <summary>A configured language.</summary>
public sealed class StructuredDataCultureModel
{
    /// <summary>ISO code, for example en-AU.</summary>
    public string IsoCode { get; set; } = string.Empty;

    /// <summary>Display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>True for the default language.</summary>
    public bool IsDefault { get; set; }
}

/// <summary>The export and seed file format.</summary>
public sealed class StructuredDataRulesExportModel
{
    /// <summary>Format version.</summary>
    public int Version { get; set; } = 1;

    /// <summary>The rules.</summary>
    public List<StructuredDataRuleModel> Rules { get; set; } = [];
}

/// <summary>Import request: the rules to load and whether to replace what exists.</summary>
public sealed class StructuredDataRulesImportRequestModel
{
    /// <summary>Format version of <see cref="Rules"/>.</summary>
    public int Version { get; set; } = 1;

    /// <summary>The rules.</summary>
    public List<StructuredDataRuleModel> Rules { get; set; } = [];

    /// <summary>True replaces every existing rule; false upserts by key.</summary>
    public bool Replace { get; set; }
}

/// <summary>A document type and its bindable properties, for the rule editor.</summary>
public sealed class StructuredDataDocumentTypeModel
{
    /// <summary>Content type alias.</summary>
    public string Alias { get; set; } = string.Empty;

    /// <summary>Content type name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Content type icon.</summary>
    public string? Icon { get; set; }

    /// <summary>True for element types, which never have pages of their own.</summary>
    public bool IsElement { get; set; }

    /// <summary>Own and composed properties.</summary>
    public List<StructuredDataPropertyModel> Properties { get; set; } = [];
}

/// <summary>A bindable property.</summary>
public sealed class StructuredDataPropertyModel
{
    /// <summary>Property alias.</summary>
    public string Alias { get; set; } = string.Empty;

    /// <summary>Property name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Property editor schema alias, so the editor can hint at the value shape.</summary>
    public string EditorAlias { get; set; } = string.Empty;
}

/// <summary>Request to evaluate a rule against a document.</summary>
public sealed class StructuredDataRulePreviewRequestModel
{
    /// <summary>The rule to evaluate; need not be saved.</summary>
    public StructuredDataRuleModel Rule { get; set; } = new();

    /// <summary>The document to evaluate it against.</summary>
    public Guid DocumentId { get; set; }

    /// <summary>The culture to evaluate as; null for the default.</summary>
    public string? Culture { get; set; }
}

/// <summary>Resolved JSON-LD nodes.</summary>
public sealed class StructuredDataNodesResponseModel
{
    /// <summary>The nodes, each carrying <c>@context</c>.</summary>
    public List<JsonObject> Nodes { get; set; } = [];
}
