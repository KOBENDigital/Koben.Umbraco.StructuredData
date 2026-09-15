using Koben.Umbraco.StructuredData.Graph;
using Koben.Umbraco.StructuredData.Resolution;
using Koben.Umbraco.StructuredData.ViewModels;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PublishedCache;

namespace Koben.Umbraco.StructuredData.Controllers;

/// <summary>Evaluates rules against real documents so an editor can see what a rule produces.</summary>
public sealed class PreviewController(IStructuredDataGraphService graphService, IPublishedContentCache contentCache, IVariationContextAccessor variationContextAccessor) : StructuredDataControllerBase
{
    /// <summary>Evaluates one (possibly unsaved) rule against a document.</summary>
    [HttpPost("rules/preview")]
    [ProducesResponseType(typeof(StructuredDataNodesResponseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult PreviewRule([FromBody] StructuredDataRulePreviewRequestModel request)
    {
        if (request.Rule.Validate() is { } problem)
        {
            return Problem(detail: problem, title: "Invalid rule", statusCode: StatusCodes.Status400BadRequest, type: InvalidRuleProblem);
        }

        IPublishedContent? content = contentCache.GetById(preview: true, request.DocumentId);
        if (content is null)
        {
            return DocumentNotFound(request.DocumentId);
        }

        // Evaluate as the chosen culture, so the test panel shows what that language's page emits.
        if (!string.IsNullOrWhiteSpace(request.Culture))
        {
            variationContextAccessor.VariationContext = new VariationContext(request.Culture);
        }

        return Ok(new StructuredDataNodesResponseModel
        {
            Nodes = [.. graphService.Preview(request.Rule.ToRule(), content, StructuredDataUrlMode.Website)],
        });
    }

    /// <summary>The complete graph a document emits, rules and authored entries merged.</summary>
    [HttpGet("graph/{documentId:guid}")]
    [ProducesResponseType(typeof(StructuredDataNodesResponseModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult Graph(Guid documentId)
    {
        IPublishedContent? content = contentCache.GetById(preview: true, documentId);
        if (content is null)
        {
            return DocumentNotFound(documentId);
        }

        return Ok(new StructuredDataNodesResponseModel
        {
            Nodes = [.. graphService.Build(content, StructuredDataUrlMode.Website, preview: true)],
        });
    }

    private IActionResult DocumentNotFound(Guid documentId) => Problem(
        detail: $"No document has the id {documentId}.",
        title: "Document not found",
        statusCode: StatusCodes.Status404NotFound,
        type: DocumentNotFoundProblem);
}
