using Koben.Umbraco.StructuredData.Configuration;
using Koben.Umbraco.StructuredData.DeliveryApi;
using Koben.Umbraco.StructuredData.Graph;
using Koben.Umbraco.StructuredData.Persistence;
using Koben.Umbraco.StructuredData.Resolution;
using Koben.Umbraco.StructuredData.Rules;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DeliveryApi;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Extensions;

namespace Koben.Umbraco.StructuredData;

/// <summary>
/// Registers the resolver, the rules store and evaluator, the graph service, the Delivery API
/// response builder and the startup handlers. The data editor, converter and controllers are
/// discovered by Umbraco's type scanning.
/// </summary>
public sealed class StructuredDataComposer : IComposer
{
    /// <inheritdoc />
    public void Compose(IUmbracoBuilder builder)
    {
        builder.Services.Configure<StructuredDataOptions>(builder.Config.GetSection(StructuredDataOptions.SectionName));

        // Singletons: all stateless, or (the cache) guarded, over singleton dependencies.
        builder.Services.AddSingleton<IStructuredDataResolver, StructuredDataResolver>();
        builder.Services.AddSingleton<StructuredDataRuleCache>();
        builder.Services.AddSingleton<IStructuredDataRuleRepository, StructuredDataRuleRepository>();
        builder.Services.AddSingleton<StructuredDataDictionaryCache>();
        builder.Services.AddSingleton<IStructuredDataRuleEvaluator, StructuredDataRuleEvaluator>();
        builder.Services.AddSingleton<IStructuredDataGraphService, StructuredDataGraphService>();

        bool disableGraph = builder.Config.GetValue<bool>($"{StructuredDataOptions.SectionName}:{nameof(StructuredDataOptions.DisableDeliveryApiGraph)}");
        if (!disableGraph)
        {
            builder.Services.AddUnique<IApiContentResponseBuilder, StructuredDataApiContentResponseBuilder>();
        }

        builder.AddNotificationAsyncHandler<UmbracoApplicationStartingNotification, StructuredDataMigrationRunner>();
        builder.AddNotificationHandler<UmbracoApplicationStartedNotification, StructuredDataRuleSeeder>();
    }
}
