using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace Koben.Umbraco.StructuredData.Persistence;

/// <summary>Database row behind a <see cref="Rules.StructuredDataRule"/>.</summary>
[TableName(TableName)]
[PrimaryKey("id", AutoIncrement = true)]
[ExplicitColumns]
public sealed class StructuredDataRuleDto
{
    /// <summary>The table name; also the migration's identity.</summary>
    public const string TableName = "kobenStructuredDataRule";

    /// <summary>Surrogate key.</summary>
    [Column("id")]
    [PrimaryKeyColumn(AutoIncrement = true)]
    public int Id { get; set; }

    /// <summary>Public identity used by the API and the export format.</summary>
    [Column("key")]
    [Index(IndexTypes.UniqueNonClustered, Name = "IX_kobenStructuredDataRule_key")]
    public Guid Key { get; set; }

    /// <summary>Editor-facing name.</summary>
    [Column("name")]
    [Length(255)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether the rule is evaluated.</summary>
    [Column("enabled")]
    public bool Enabled { get; set; }

    /// <summary>Evaluation order.</summary>
    [Column("sortOrder")]
    public int SortOrder { get; set; }

    /// <summary><c>site</c> or <c>documentTypes</c>.</summary>
    [Column("scope")]
    [Length(32)]
    public string Scope { get; set; } = "site";

    /// <summary>Comma-separated content type aliases.</summary>
    [Column("documentTypeAliases")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? DocumentTypeAliases { get; set; }

    /// <summary>Site roots as a JSON array of {key,name}; null for every site.</summary>
    [Column("sites")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? Sites { get; set; }

    /// <summary>Comma-separated culture ISO codes; null for every culture.</summary>
    [Column("cultures")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? Cultures { get; set; }

    /// <summary>The rule definition as JSON.</summary>
    [Column("definition")]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string Definition { get; set; } = "{}";

    /// <summary>Last write, UTC.</summary>
    [Column("updateDate")]
    public DateTime UpdateDate { get; set; }
}
