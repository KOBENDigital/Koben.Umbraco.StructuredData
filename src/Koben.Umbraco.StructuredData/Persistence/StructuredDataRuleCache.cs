using Koben.Umbraco.StructuredData.Rules;

namespace Koben.Umbraco.StructuredData.Persistence;

/// <summary>
/// The enabled rules, read once and kept until a write invalidates them. Rules are read on every
/// Delivery API response, so they must never cost a query each time. A short lifetime bounds drift
/// between servers that do not share invalidation.
/// </summary>
public sealed class StructuredDataRuleCache
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    private readonly Lock _gate = new();
    private IReadOnlyList<StructuredDataRule>? _rules;
    private DateTime _loadedAt;

    /// <summary>Returns the enabled rules in evaluation order, loading them through <paramref name="load"/> when stale.</summary>
    /// <param name="load">Reads every rule from storage.</param>
    public IReadOnlyList<StructuredDataRule> GetEnabled(Func<IReadOnlyList<StructuredDataRule>> load)
    {
        lock (_gate)
        {
            if (_rules is null || DateTime.UtcNow - _loadedAt > Lifetime)
            {
                _rules = load().Where(rule => rule.Enabled).ToList();
                _loadedAt = DateTime.UtcNow;
            }

            return _rules;
        }
    }

    /// <summary>Forgets the cached rules so the next read hits storage.</summary>
    public void Invalidate()
    {
        lock (_gate)
        {
            _rules = null;
        }
    }
}
