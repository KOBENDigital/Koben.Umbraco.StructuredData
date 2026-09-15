using System.Text.Json.Serialization;

namespace Koben.Umbraco.StructuredData.Models;

/// <summary>
/// The stored document behind a Structured Data property.
/// </summary>
public sealed class StructuredDataValue
{
    /// <summary>Document version, for forward migrations.</summary>
    [JsonPropertyName("version")]
    public int Version { get; set; } = StructuredDataConstants.CurrentValueVersion;

    /// <summary>Authored entries in editor order.</summary>
    [JsonPropertyName("items")]
    public List<StructuredDataItem> Items { get; set; } = [];
}
