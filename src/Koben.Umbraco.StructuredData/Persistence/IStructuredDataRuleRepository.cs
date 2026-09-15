using Koben.Umbraco.StructuredData.Rules;

namespace Koben.Umbraco.StructuredData.Persistence;

/// <summary>Persistence for generation rules.</summary>
public interface IStructuredDataRuleRepository
{
    /// <summary>Reads every rule, ordered by sort order then name.</summary>
    /// <returns>All rules, enabled or not.</returns>
    IReadOnlyList<StructuredDataRule> GetAll();

    /// <summary>Reads one rule.</summary>
    /// <param name="key">The rule's key.</param>
    /// <returns>The rule, or null when none has that key.</returns>
    StructuredDataRule? Get(Guid key);

    /// <summary>Inserts or updates a rule by key.</summary>
    /// <param name="rule">The rule to store; its key must be set.</param>
    void Save(StructuredDataRule rule);

    /// <summary>Removes a rule.</summary>
    /// <param name="key">The rule's key.</param>
    /// <returns>True when a row was removed.</returns>
    bool Delete(Guid key);

    /// <summary>Replaces every rule with the given set, in one transaction.</summary>
    /// <param name="rules">The new complete set.</param>
    void ReplaceAll(IEnumerable<StructuredDataRule> rules);
}
