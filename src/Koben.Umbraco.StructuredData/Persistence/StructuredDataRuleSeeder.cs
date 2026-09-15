using System.Text.Json;
using Koben.Umbraco.StructuredData.Configuration;
using Koben.Umbraco.StructuredData.Rules;
using Koben.Umbraco.StructuredData.ViewModels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Sync;

namespace Koben.Umbraco.StructuredData.Persistence;

/// <summary>Loads the configured seed file into an empty rules table on the first boot that has one.</summary>
public sealed class StructuredDataRuleSeeder(
    IStructuredDataRuleRepository repository,
    IOptions<StructuredDataOptions> options,
    IHostEnvironment hostEnvironment,
    IRuntimeState runtimeState,
    IServerRoleAccessor serverRoleAccessor,
    ILogger<StructuredDataRuleSeeder> logger) : INotificationHandler<UmbracoApplicationStartedNotification>
{
    /// <inheritdoc />
    public void Handle(UmbracoApplicationStartedNotification notification)
    {
        string? seedFile = options.Value.SeedFile;
        if (string.IsNullOrWhiteSpace(seedFile) || runtimeState.Level < RuntimeLevel.Run || serverRoleAccessor.CurrentServerRole == ServerRole.Subscriber)
        {
            return;
        }

        string path = Path.IsPathRooted(seedFile) ? seedFile : Path.Combine(hostEnvironment.ContentRootPath, seedFile);
        if (!File.Exists(path))
        {
            logger.LogWarning("Structured data seed file {Path} does not exist; nothing seeded.", path);
            return;
        }

        try
        {
            if (repository.GetAll().Count > 0)
            {
                return;
            }

            StructuredDataRulesExportModel? export = JsonSerializer.Deserialize<StructuredDataRulesExportModel>(File.ReadAllText(path), StructuredDataRuleModel.JsonOptions);
            List<StructuredDataRule> rules = export?.Rules.Select(model => model.ToRule()).ToList() ?? [];
            if (rules.Count == 0)
            {
                return;
            }

            repository.ReplaceAll(rules);
            logger.LogInformation("Seeded {Count} structured data rules from {Path}.", rules.Count, path);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Structured data seed file {Path} could not be loaded.", path);
        }
    }
}
