namespace Koben.Umbraco.StructuredData.Configuration;

/// <summary>Package settings, bound from <c>Koben:StructuredData</c>.</summary>
public sealed class StructuredDataOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Koben:StructuredData";

    /// <summary>
    /// Path (relative to the content root) of a rules export to load when the site has no rules
    /// yet, so a fresh environment starts with the same generation as the one it was exported from.
    /// </summary>
    public string? SeedFile { get; set; }

    /// <summary>Disables the Delivery API <c>structuredDataGraph</c> property.</summary>
    public bool DisableDeliveryApiGraph { get; set; }
}
