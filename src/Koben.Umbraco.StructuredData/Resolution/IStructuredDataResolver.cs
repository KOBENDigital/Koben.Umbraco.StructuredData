using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Models;

namespace Koben.Umbraco.StructuredData.Resolution;

/// <summary>
/// Turns a stored <see cref="StructuredDataValue"/> into emit-ready JSON-LD nodes.
/// </summary>
public interface IStructuredDataResolver
{
    /// <summary>
    /// Resolves every enabled entry: reference placeholders become URLs or <c>ImageObject</c>s,
    /// empty strings, arrays and entities are dropped, and each node gains <c>@context</c>.
    /// </summary>
    /// <param name="value">The stored value; null or empty yields no nodes.</param>
    /// <param name="urlMode">The URL space to write references in.</param>
    /// <param name="preview">Whether unpublished content may be resolved.</param>
    /// <returns>The resolved nodes in editor order. Entries that resolve to nothing are omitted.</returns>
    IReadOnlyList<JsonObject> Resolve(StructuredDataValue? value, StructuredDataUrlMode urlMode, bool preview);
}
