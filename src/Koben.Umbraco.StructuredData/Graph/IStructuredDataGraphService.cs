using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Models;
using Koben.Umbraco.StructuredData.Resolution;
using Koben.Umbraco.StructuredData.Rules;
using Umbraco.Cms.Core.Models.PublishedContent;

namespace Koben.Umbraco.StructuredData.Graph;

/// <summary>
/// Assembles everything a page should emit: site-wide rules, the page's document type rules, the
/// site root's authored entries and the page's own authored entries, in that order of precedence.
/// </summary>
public interface IStructuredDataGraphService
{
    /// <summary>Builds the page's complete, resolved JSON-LD node list.</summary>
    /// <param name="content">The page.</param>
    /// <param name="urlMode">The URL space to write references in.</param>
    /// <param name="preview">Whether unpublished content may be resolved.</param>
    /// <returns>Resolved nodes, each with <c>@context</c>; empty when nothing applies.</returns>
    IReadOnlyList<JsonObject> Build(IPublishedContent content, StructuredDataUrlMode urlMode, bool preview);

    /// <summary>Builds the page's graph as a model for Razor views, with absolute website URLs.</summary>
    /// <param name="content">The page.</param>
    /// <param name="preview">Whether unpublished content may be resolved.</param>
    /// <returns>The model; <see cref="StructuredDataModel.Empty"/> when nothing applies.</returns>
    StructuredDataModel BuildModel(IPublishedContent content, bool preview = false);

    /// <summary>Evaluates one rule against a page without storing it; for the rule editor's test panel.</summary>
    /// <param name="rule">The rule to try.</param>
    /// <param name="content">The page to try it on.</param>
    /// <param name="urlMode">The URL space to write references in.</param>
    /// <returns>The resolved nodes the rule would emit (none when it applies to nothing).</returns>
    IReadOnlyList<JsonObject> Preview(StructuredDataRule rule, IPublishedContent content, StructuredDataUrlMode urlMode);
}
