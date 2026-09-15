using System.Text.Json.Nodes;
using Umbraco.Cms.Core.Models.PublishedContent;

namespace Koben.Umbraco.StructuredData.Rules;

/// <summary>
/// Evaluates a rule's bindings against a document, producing a JSON-LD-shaped node that still
/// carries reference placeholders for <see cref="Resolution.IStructuredDataResolver"/> to resolve.
/// </summary>
public interface IStructuredDataRuleEvaluator
{
    /// <summary>Builds the rule's node for a document.</summary>
    /// <param name="rule">The rule; its definition supplies the <c>@type</c> and bindings.</param>
    /// <param name="content">The document the values come from.</param>
    /// <returns>The unresolved node, or null when the definition has no <c>@type</c>.</returns>
    JsonObject? Evaluate(StructuredDataRule rule, IPublishedContent content);
}
