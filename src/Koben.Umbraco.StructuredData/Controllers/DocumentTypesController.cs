using Koben.Umbraco.StructuredData.ViewModels;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;

namespace Koben.Umbraco.StructuredData.Controllers;

/// <summary>Document types and their bindable properties, for the rule editor's pickers.</summary>
public sealed class DocumentTypesController(IContentTypeService contentTypeService) : StructuredDataControllerBase
{
    /// <summary>Lists every non-element document type with its own and composed properties.</summary>
    [HttpGet("document-types")]
    [ProducesResponseType(typeof(IEnumerable<StructuredDataDocumentTypeModel>), StatusCodes.Status200OK)]
    public IActionResult GetAll()
    {
        IEnumerable<StructuredDataDocumentTypeModel> models = contentTypeService.GetAll()
            .Where(contentType => !contentType.IsElement)
            .OrderBy(contentType => contentType.Name)
            .Select(Map);

        return Ok(models);
    }

    private static StructuredDataDocumentTypeModel Map(IContentType contentType) => new()
    {
        Alias = contentType.Alias,
        Name = contentType.Name ?? contentType.Alias,
        Icon = contentType.Icon,
        IsElement = contentType.IsElement,
        Properties = contentType.CompositionPropertyTypes
            .OrderBy(property => property.Name)
            .Select(property => new StructuredDataPropertyModel
            {
                Alias = property.Alias,
                Name = property.Name,
                EditorAlias = property.PropertyEditorAlias,
            })
            .ToList(),
    };
}
