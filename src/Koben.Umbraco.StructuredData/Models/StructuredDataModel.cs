using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Html;

namespace Koben.Umbraco.StructuredData.Models;

/// <summary>
/// The published shape of a Structured Data property: the enabled entries, with every reference
/// resolved and every empty value stripped, ready to serialise as JSON-LD.
/// </summary>
public sealed class StructuredDataModel
{
    private static readonly JsonSerializerOptions CompactOptions = new()
    {
        // JSON-LD lives inside a <script> element; escaping '<' keeps a value from closing it.
        Encoder = JavaScriptEncoder.Default,
    };

    private static readonly JsonSerializerOptions IndentedOptions = new(CompactOptions)
    {
        WriteIndented = true,
    };

    /// <summary>An empty model, used where a property holds nothing publishable.</summary>
    public static StructuredDataModel Empty { get; } = new([]);

    /// <summary>Creates a model over already-resolved nodes.</summary>
    /// <param name="nodes">Resolved JSON-LD nodes, each carrying its <c>@context</c>.</param>
    public StructuredDataModel(IReadOnlyList<JsonObject> nodes) => Nodes = nodes;

    /// <summary>The resolved JSON-LD nodes in editor order.</summary>
    public IReadOnlyList<JsonObject> Nodes { get; }

    /// <summary>True when there is nothing to emit.</summary>
    public bool IsEmpty => Nodes.Count == 0;

    /// <summary>
    /// Serialises the nodes as a JSON-LD document: a single object when there is one node,
    /// otherwise a <c>@graph</c>-free array, which every consumer that reads JSON-LD accepts.
    /// </summary>
    /// <param name="indented">Pretty-print for readability; compact by default.</param>
    /// <returns>The JSON text, or an empty string when the model is empty.</returns>
    public string ToJsonLd(bool indented = false)
    {
        if (IsEmpty)
        {
            return string.Empty;
        }

        JsonSerializerOptions options = indented ? IndentedOptions : CompactOptions;
        JsonNode payload = Nodes.Count == 1 ? Nodes[0] : new JsonArray(Nodes.Select(node => (JsonNode)node.DeepClone()).ToArray());

        return payload.ToJsonString(options);
    }

    /// <summary>
    /// Renders one <c>&lt;script type="application/ld+json"&gt;</c> element per node, for Razor views.
    /// </summary>
    /// <returns>Markup safe to write unencoded, or empty content when the model is empty.</returns>
    public IHtmlContent ToScriptTags()
    {
        if (IsEmpty)
        {
            return HtmlString.Empty;
        }

        var builder = new HtmlContentBuilder();
        foreach (JsonObject node in Nodes)
        {
            builder.AppendHtml("<script type=\"application/ld+json\">");
            builder.AppendHtml(node.ToJsonString(CompactOptions));
            builder.AppendHtml("</script>\n");
        }

        return builder;
    }
}
