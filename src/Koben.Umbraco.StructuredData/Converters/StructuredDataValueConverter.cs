using System.Text.Json;
using System.Text.Json.Nodes;
using Koben.Umbraco.StructuredData.Models;
using Koben.Umbraco.StructuredData.Resolution;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.PropertyEditors;
using Umbraco.Cms.Core.PropertyEditors.DeliveryApi;

namespace Koben.Umbraco.StructuredData.Converters;

/// <summary>
/// Publishes a Structured Data property as a <see cref="StructuredDataModel"/> for Razor and as an
/// array of resolved JSON-LD objects for the Delivery API.
/// </summary>
public sealed class StructuredDataValueConverter(
    IStructuredDataResolver resolver,
    ILogger<StructuredDataValueConverter> logger) : PropertyValueConverterBase, IDeliveryApiPropertyValueConverter
{
    private static readonly JsonSerializerOptions ParseOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    /// <inheritdoc />
    public override bool IsConverter(IPublishedPropertyType propertyType)
        => propertyType.EditorAlias.Equals(StructuredDataConstants.SchemaAlias, StringComparison.OrdinalIgnoreCase);

    /// <inheritdoc />
    public override Type GetPropertyValueType(IPublishedPropertyType propertyType) => typeof(StructuredDataModel);

    /// <summary>
    /// Elements rather than Element: a node may embed another document's URL or a media item's
    /// dimensions, which change independently of the owning content.
    /// </summary>
    public override PropertyCacheLevel GetPropertyCacheLevel(IPublishedPropertyType propertyType) => PropertyCacheLevel.Elements;

    /// <inheritdoc />
    public override bool? IsValue(object? value, PropertyValueLevel level)
        => level switch
        {
            PropertyValueLevel.Source => value is string text && !string.IsNullOrWhiteSpace(text),
            PropertyValueLevel.Inter => value is StructuredDataValue { Items.Count: > 0 },
            PropertyValueLevel.Object => value is StructuredDataModel { IsEmpty: false },
            _ => null,
        };

    /// <inheritdoc />
    public override object? ConvertSourceToIntermediate(IPublishedElement owner, IPublishedPropertyType propertyType, object? source, bool preview)
    {
        if (source is not string text || string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        try
        {
            StructuredDataValue? value = JsonSerializer.Deserialize<StructuredDataValue>(text, ParseOptions);
            return value?.Items.Count > 0 ? value : null;
        }
        catch (JsonException exception)
        {
            logger.LogWarning(exception, "Structured data on {ContentKey}/{PropertyAlias} is not readable and was skipped.", owner.Key, propertyType.Alias);
            return null;
        }
    }

    /// <inheritdoc />
    public override object ConvertIntermediateToObject(IPublishedElement owner, IPublishedPropertyType propertyType, PropertyCacheLevel referenceCacheLevel, object? inter, bool preview)
    {
        IReadOnlyList<JsonObject> nodes = resolver.Resolve(inter as StructuredDataValue, StructuredDataUrlMode.Website, preview);
        return nodes.Count == 0 ? StructuredDataModel.Empty : new StructuredDataModel(nodes);
    }

    /// <inheritdoc />
    public PropertyCacheLevel GetDeliveryApiPropertyCacheLevel(IPublishedPropertyType propertyType) => PropertyCacheLevel.Elements;

    /// <inheritdoc />
    public PropertyCacheLevel GetDeliveryApiPropertyCacheLevelForExpansion(IPublishedPropertyType propertyType) => PropertyCacheLevel.Elements;

    /// <inheritdoc />
    public Type GetDeliveryApiPropertyValueType(IPublishedPropertyType propertyType) => typeof(IEnumerable<JsonObject>);

    /// <inheritdoc />
    public object? ConvertIntermediateToDeliveryApiObject(IPublishedElement owner, IPublishedPropertyType propertyType, PropertyCacheLevel referenceCacheLevel, object? inter, bool preview, bool expanding)
        => resolver.Resolve(inter as StructuredDataValue, StructuredDataUrlMode.DeliveryApi, preview);
}
