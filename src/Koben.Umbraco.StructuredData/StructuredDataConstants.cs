namespace Koben.Umbraco.StructuredData;

/// <summary>
/// Identifiers shared by the C# package and its backoffice bundle. A data type stores
/// <see cref="SchemaAlias"/>, so renaming any of these is a content-model change, not a refactor.
/// </summary>
public static class StructuredDataConstants
{
    /// <summary>Package id, matching <c>umbraco-package.json</c>.</summary>
    public const string PackageId = "Koben.StructuredData";

    /// <summary>Root path the backoffice bundle is served from.</summary>
    public const string AppPluginsPath = "/App_Plugins/Koben.StructuredData";

    /// <summary>Property editor schema alias, as stored against a data type.</summary>
    public const string SchemaAlias = "Koben.StructuredData";

    /// <summary>Property editor UI alias, as selected on a data type.</summary>
    public const string PropertyEditorUiAlias = "Koben.PropertyEditorUi.StructuredData";

    /// <summary>The JSON-LD context every emitted node carries.</summary>
    public const string SchemaOrgContext = "https://schema.org";

    /// <summary>The stored document version this package writes and reads.</summary>
    public const int CurrentValueVersion = 1;

    /// <summary>Keys of the reference placeholders the editor writes into a node.</summary>
    public static class Reference
    {
        /// <summary>Discriminator key on a placeholder object.</summary>
        public const string Key = "$ref";

        /// <summary>The Umbraco key (GUID) the placeholder points at.</summary>
        public const string Target = "key";

        /// <summary>Optional shape hint: <c>url</c> emits a bare URL string instead of an object.</summary>
        public const string Shape = "as";

        /// <summary>Placeholder for a media item; resolves to an <c>ImageObject</c> or a URL.</summary>
        public const string Media = "media";

        /// <summary>Placeholder for a document; resolves to its URL.</summary>
        public const string Document = "document";

        /// <summary>Shape hint value that emits a bare URL string.</summary>
        public const string UrlShape = "url";

        /// <summary>Optional fragment appended to a resolved document URL (<c>#organization</c>), for stable <c>@id</c>s.</summary>
        public const string Fragment = "fragment";
    }
}
