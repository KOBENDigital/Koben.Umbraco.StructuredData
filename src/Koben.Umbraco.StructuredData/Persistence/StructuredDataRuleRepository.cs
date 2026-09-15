using System.Text.Json;
using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Rules;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence;
using Umbraco.Cms.Infrastructure.Scoping;
using Umbraco.Extensions;

namespace Koben.Umbraco.StructuredData.Persistence;

/// <inheritdoc />
public sealed class StructuredDataRuleRepository(IScopeProvider scopeProvider, StructuredDataRuleCache cache) : IStructuredDataRuleRepository
{
    /// <inheritdoc />
    public IReadOnlyList<StructuredDataRule> GetAll()
    {
        using IScope scope = scopeProvider.CreateScope(autoComplete: true);
        Sql<ISqlContext> sql = scope.SqlContext.Sql()
            .Select<StructuredDataRuleDto>()
            .From<StructuredDataRuleDto>()
            .OrderBy<StructuredDataRuleDto>(dto => dto.SortOrder, dto => dto.Name);

        return scope.Database.Fetch<StructuredDataRuleDto>(sql).Select(ToRule).ToList();
    }

    /// <inheritdoc />
    public StructuredDataRule? Get(Guid key)
    {
        using IScope scope = scopeProvider.CreateScope(autoComplete: true);
        StructuredDataRuleDto? dto = Fetch(scope, key);
        return dto is null ? null : ToRule(dto);
    }

    /// <inheritdoc />
    public void Save(StructuredDataRule rule)
    {
        using IScope scope = scopeProvider.CreateScope();
        StructuredDataRuleDto? existing = Fetch(scope, rule.Key);
        StructuredDataRuleDto dto = ToDto(rule, existing);

        if (existing is null)
        {
            scope.Database.Insert(dto);
        }
        else
        {
            scope.Database.Update(dto);
        }

        scope.Complete();
        cache.Invalidate();
    }

    /// <inheritdoc />
    public bool Delete(Guid key)
    {
        using IScope scope = scopeProvider.CreateScope();
        StructuredDataRuleDto? existing = Fetch(scope, key);
        if (existing is null)
        {
            return false;
        }

        scope.Database.Delete(existing);
        scope.Complete();
        cache.Invalidate();
        return true;
    }

    /// <inheritdoc />
    public void ReplaceAll(IEnumerable<StructuredDataRule> rules)
    {
        using IScope scope = scopeProvider.CreateScope();
        scope.Database.Execute($"DELETE FROM {StructuredDataRuleDto.TableName}");
        foreach (StructuredDataRule rule in rules)
        {
            scope.Database.Insert(ToDto(rule, null));
        }

        scope.Complete();
        cache.Invalidate();
    }

    private static readonly JsonSerializerOptions SiteJsonOptions = new(JsonSerializerDefaults.Web);

    private static List<string> SplitList(string? value) =>
        (value ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static List<StructuredDataRuleSite> ParseSites(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<StructuredDataRuleSite>>(json, SiteJsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static StructuredDataRuleDto? Fetch(IScope scope, Guid key)
    {
        Sql<ISqlContext> sql = scope.SqlContext.Sql()
            .Select<StructuredDataRuleDto>()
            .From<StructuredDataRuleDto>()
            .Where<StructuredDataRuleDto>(dto => dto.Key == key);

        return scope.Database.FirstOrDefault<StructuredDataRuleDto>(sql);
    }

    /// <summary>Maps a row to the domain model; an unreadable definition becomes an empty one rather than a throw.</summary>
    private static StructuredDataRule ToRule(StructuredDataRuleDto dto)
    {
        JsonObject definition;
        try
        {
            definition = JsonNode.Parse(dto.Definition) as JsonObject ?? new JsonObject();
        }
        catch (JsonException)
        {
            definition = new JsonObject();
        }

        return new StructuredDataRule
        {
            Key = dto.Key,
            Name = dto.Name,
            Enabled = dto.Enabled,
            SortOrder = dto.SortOrder,
            Scope = string.Equals(dto.Scope, "documentTypes", StringComparison.OrdinalIgnoreCase)
                ? StructuredDataRuleScope.DocumentTypes
                : StructuredDataRuleScope.Site,
            DocumentTypeAliases = SplitList(dto.DocumentTypeAliases),
            Sites = ParseSites(dto.Sites),
            Cultures = SplitList(dto.Cultures),
            Definition = definition,
        };
    }

    private static StructuredDataRuleDto ToDto(StructuredDataRule rule, StructuredDataRuleDto? existing) => new()
    {
        Id = existing?.Id ?? 0,
        Key = rule.Key,
        Name = rule.Name,
        Enabled = rule.Enabled,
        SortOrder = rule.SortOrder,
        Scope = rule.Scope == StructuredDataRuleScope.DocumentTypes ? "documentTypes" : "site",
        DocumentTypeAliases = rule.DocumentTypeAliases.Count == 0 ? null : string.Join(",", rule.DocumentTypeAliases),
        Sites = rule.Sites.Count == 0 ? null : JsonSerializer.Serialize(rule.Sites, SiteJsonOptions),
        Cultures = rule.Cultures.Count == 0 ? null : string.Join(",", rule.Cultures),
        Definition = rule.Definition.ToJsonString(),
        UpdateDate = DateTime.UtcNow,
    };
}
