using System.Collections.Concurrent;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;

namespace Koben.Umbraco.StructuredData.Rules;

/// <summary>
/// Dictionary translations for rule bindings, cached briefly: the dictionary service is async and
/// database-backed, while rules are evaluated synchronously on every content response.
/// </summary>
public sealed class StructuredDataDictionaryCache(IDictionaryItemService dictionaryItemService, ILanguageService languageService)
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    private readonly ConcurrentDictionary<string, (DateTime LoadedAt, Dictionary<string, string> Translations)> _items = new(StringComparer.OrdinalIgnoreCase);
    private (DateTime LoadedAt, string? IsoCode) _default;

    /// <summary>The translation for a key in a culture, falling back to the default language's.</summary>
    /// <param name="key">The dictionary item key.</param>
    /// <param name="culture">The request culture, or null for the default language.</param>
    /// <returns>The translation, or null when the item or translation does not exist.</returns>
    public string? Translate(string key, string? culture)
    {
        Dictionary<string, string> translations = Load(key);
        if (culture is not null && translations.TryGetValue(culture, out string? localized) && !string.IsNullOrWhiteSpace(localized))
        {
            return localized;
        }

        string? fallback = DefaultIsoCode();
        return fallback is not null && translations.TryGetValue(fallback, out string? text) ? text : translations.Values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
    }

    /// <summary>Forgets every cached translation.</summary>
    public void Invalidate() => _items.Clear();

    private Dictionary<string, string> Load(string key)
    {
        if (_items.TryGetValue(key, out (DateTime LoadedAt, Dictionary<string, string> Translations) cached) && DateTime.UtcNow - cached.LoadedAt < Lifetime)
        {
            return cached.Translations;
        }

        // Sync over async: the callers are Umbraco's synchronous value conversion and response
        // building paths, and the result is cached so this costs one query per key per lifetime.
        IDictionaryItem? item = dictionaryItemService.GetAsync(key).ConfigureAwait(false).GetAwaiter().GetResult();
        var translations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (IDictionaryTranslation translation in item?.Translations ?? [])
        {
            if (!string.IsNullOrWhiteSpace(translation.LanguageIsoCode))
            {
                translations[translation.LanguageIsoCode] = translation.Value ?? string.Empty;
            }
        }

        _items[key] = (DateTime.UtcNow, translations);
        return translations;
    }

    private string? DefaultIsoCode()
    {
        if (_default.IsoCode is not null && DateTime.UtcNow - _default.LoadedAt < Lifetime)
        {
            return _default.IsoCode;
        }

        string? iso = languageService.GetDefaultIsoCodeAsync().ConfigureAwait(false).GetAwaiter().GetResult();
        _default = (DateTime.UtcNow, iso);
        return iso;
    }
}
