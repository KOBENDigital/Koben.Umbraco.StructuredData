using Koben.Umbraco.StructuredData.Graph;
using Koben.Umbraco.StructuredData.Resolution;
using Umbraco.Cms.Core.DeliveryApi;
using Umbraco.Cms.Core.Models.DeliveryApi;
using Umbraco.Cms.Core.Models.PublishedContent;

namespace Koben.Umbraco.StructuredData.DeliveryApi;

/// <summary>
/// Adds the page's complete structured data graph to every Delivery API content response as the
/// <c>structuredDataGraph</c> property, so a headless frontend renders it without knowing the rules.
/// </summary>
public sealed class StructuredDataApiContentResponseBuilder(
    IApiContentNameProvider apiContentNameProvider,
    IApiContentRouteBuilder apiContentRouteBuilder,
    IOutputExpansionStrategyAccessor outputExpansionStrategyAccessor,
    IVariationContextAccessor variationContextAccessor,
    IStructuredDataGraphService graphService,
    IRequestPreviewService requestPreviewService)
    : ApiContentResponseBuilder(apiContentNameProvider, apiContentRouteBuilder, outputExpansionStrategyAccessor, variationContextAccessor)
{
    /// <summary>The property name the graph is written under.</summary>
    public const string PropertyName = "structuredDataGraph";

    /// <inheritdoc />
    protected override IApiContentResponse Create(IPublishedContent content, string name, IApiContentRoute route, IDictionary<string, object?> properties)
    {
        properties[PropertyName] = graphService.Build(content, StructuredDataUrlMode.DeliveryApi, requestPreviewService.IsPreview());
        return base.Create(content, name, route, properties);
    }
}
