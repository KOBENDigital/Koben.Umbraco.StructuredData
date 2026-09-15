using Umbraco.Cms.Core.Migrations;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Sync;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Migrations.Upgrade;

namespace Koben.Umbraco.StructuredData.Persistence;

/// <summary>Creates the rules table.</summary>
public sealed class AddStructuredDataRuleTable : AsyncMigrationBase
{
    /// <summary>Constructs the migration. Resolved by the migration builder, not by callers.</summary>
    public AddStructuredDataRuleTable(IMigrationContext context)
        : base(context)
    {
    }

    /// <inheritdoc />
    protected override Task MigrateAsync()
    {
        if (!TableExists(StructuredDataRuleDto.TableName))
        {
            Create.Table<StructuredDataRuleDto>().Do();
        }

        return Task.CompletedTask;
    }
}

/// <summary>Adds the site and culture targeting columns to a v1 table.</summary>
public sealed class AddStructuredDataRuleTargeting : AsyncMigrationBase
{
    /// <summary>Constructs the migration. Resolved by the migration builder, not by callers.</summary>
    public AddStructuredDataRuleTargeting(IMigrationContext context)
        : base(context)
    {
    }

    /// <inheritdoc />
    protected override Task MigrateAsync()
    {
        // A fresh install creates the table from the DTO, columns included; only a v1 table needs
        // them added. Umbraco's Alter builder refuses SQLite, but SQLite supports ADD COLUMN itself,
        // so the statement is issued directly per provider.
        foreach (string column in new[] { "sites", "cultures" })
        {
            if (ColumnExists(StructuredDataRuleDto.TableName, column))
            {
                continue;
            }

            bool sqlite = SqlSyntax.ProviderName.Contains("sqlite", StringComparison.OrdinalIgnoreCase);
            string sql = sqlite
                ? $"ALTER TABLE {StructuredDataRuleDto.TableName} ADD COLUMN {column} TEXT NULL"
                : $"ALTER TABLE [{StructuredDataRuleDto.TableName}] ADD [{column}] NVARCHAR(MAX) NULL";
            Database.Execute(sql);
        }

        return Task.CompletedTask;
    }
}

/// <summary>
/// Runs the package's migration plan on startup. Idempotent: the plan's final state is recorded in
/// the key-value store, so later boots do nothing.
/// </summary>
public sealed class StructuredDataMigrationRunner(
    IMigrationPlanExecutor migrationPlanExecutor,
    ICoreScopeProvider scopeProvider,
    IKeyValueService keyValueService,
    IRuntimeState runtimeState,
    IServerRoleAccessor serverRoleAccessor) : INotificationAsyncHandler<UmbracoApplicationStartingNotification>
{
    /// <summary>The plan name, as recorded in <c>umbracoKeyValue</c>.</summary>
    public const string PlanName = "Koben.StructuredData";

    /// <inheritdoc />
    public async Task HandleAsync(UmbracoApplicationStartingNotification notification, CancellationToken cancellationToken)
    {
        // Subscribers must not race the scheduling publisher on the schema.
        if (runtimeState.Level < RuntimeLevel.Run || serverRoleAccessor.CurrentServerRole == ServerRole.Subscriber)
        {
            return;
        }

        var plan = new MigrationPlan(PlanName);
        plan.From(string.Empty)
            .To<AddStructuredDataRuleTable>("rules-table-v1")
            .To<AddStructuredDataRuleTargeting>("rules-table-v2");

        var upgrader = new Upgrader(plan);
        await upgrader.ExecuteAsync(migrationPlanExecutor, scopeProvider, keyValueService);
    }
}
