using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Nodes;
using Umbraco.Cms.Core.Models.Validation;
using Umbraco.Cms.Core.PropertyEditors;

namespace Koben.Umbraco.StructuredData.Validation;

/// <summary>
/// Server-side guard on what the editor may store: a document of entries where every entry's
/// node is an object carrying <c>@type</c>. Field-level completeness is advisory and lives in the
/// editor; this validator only refuses values the resolver could not emit.
/// </summary>
public sealed class StructuredDataValueValidator : IValueValidator
{
    /// <inheritdoc />
    public IEnumerable<ValidationResult> Validate(object? value, string? valueType, object? dataTypeConfiguration, PropertyValidationContext validationContext)
    {
        if (value is null)
        {
            yield break;
        }

        if (!TryParse(value, out JsonNode? document))
        {
            yield return new ValidationResult("Structured data is not valid JSON.");
            yield break;
        }

        if (document is null)
        {
            yield break;
        }

        if (document is not JsonObject root || root["items"] is not JsonArray items)
        {
            yield return new ValidationResult("Structured data must be a document with an items array.");
            yield break;
        }

        for (int index = 0; index < items.Count; index++)
        {
            if (items[index] is not JsonObject item)
            {
                yield return new ValidationResult($"Structured data entry {index + 1} is not an object.");
                continue;
            }

            if (item["node"] is not JsonObject node)
            {
                yield return new ValidationResult($"Structured data entry {index + 1} has no node.");
                continue;
            }

            if (node["@type"] is not JsonValue type || string.IsNullOrWhiteSpace(type.ToString()))
            {
                yield return new ValidationResult($"Structured data entry {index + 1} has no @type.");
            }
        }
    }

    /// <summary>Reads the incoming value as JSON without letting a parse failure escape as an exception.</summary>
    private static bool TryParse(object value, out JsonNode? document)
    {
        try
        {
            document = value switch
            {
                string text when string.IsNullOrWhiteSpace(text) => null,
                string text => JsonNode.Parse(text),
                JsonNode node => node,
                _ => JsonSerializer.SerializeToNode(value),
            };
            return true;
        }
        catch (JsonException)
        {
            document = null;
            return false;
        }
    }
}
