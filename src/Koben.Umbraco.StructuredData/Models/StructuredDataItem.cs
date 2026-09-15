using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Koben.Umbraco.StructuredData.Models;

/// <summary>
/// One authored entity as the editor stores it: an identity, a catalogue type, an on/off switch
/// and the JSON-LD-shaped node itself (which may still contain reference placeholders).
/// </summary>
public sealed class StructuredDataItem
{
    /// <summary>Stable identity of the entry within the property, assigned by the editor.</summary>
    [JsonPropertyName("key")]
    public string? Key { get; set; }

    /// <summary>Catalogue type alias (for example <c>FAQPage</c>) or <c>custom</c> for raw JSON-LD.</summary>
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    /// <summary>Whether the entry is emitted. Disabled entries are kept for editing but never published.</summary>
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    /// <summary>Optional editor-facing note; never emitted.</summary>
    [JsonPropertyName("note")]
    public string? Note { get; set; }

    /// <summary>The JSON-LD node as authored, before reference resolution.</summary>
    [JsonPropertyName("node")]
    public JsonObject? Node { get; set; }
}
