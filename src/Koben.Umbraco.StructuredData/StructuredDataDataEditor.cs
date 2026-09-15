using Koben.Umbraco.StructuredData.Validation;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.PropertyEditors;

namespace Koben.Umbraco.StructuredData;

/// <summary>
/// Server half of the Structured Data property editor. The backoffice bundle declares the matching
/// <c>propertyEditorSchema</c>, but that registration is client-side only — without this editor the
/// Management API rejects a data type built on the alias with <c>PropertyEditorNotFound</c>.
/// </summary>
[DataEditor(StructuredDataConstants.SchemaAlias, ValueType = ValueTypes.Json, ValueEditorIsReusable = true)]
public class StructuredDataDataEditor : DataEditor
{
    /// <summary>Constructs the editor. Resolved by Umbraco's data editor collection, not by callers.</summary>
    public StructuredDataDataEditor(IDataValueEditorFactory dataValueEditorFactory)
        : base(dataValueEditorFactory)
        => SupportsReadOnly = true;

    /// <inheritdoc />
    protected override IDataValueEditor CreateValueEditor()
    {
        IDataValueEditor editor = base.CreateValueEditor();
        if (editor is DataValueEditor valueEditor)
        {
            valueEditor.Validators.Add(new StructuredDataValueValidator());
        }

        return editor;
    }
}
