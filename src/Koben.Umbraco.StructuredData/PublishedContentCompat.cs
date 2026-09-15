using System.Linq.Expressions;
using System.Reflection;
using Umbraco.Cms.Core.Models.PublishedContent;

namespace Koben.Umbraco.StructuredData;

/// <summary>
/// Reads the published-content members that moved between Umbraco majors without binding to either
/// interface at compile time.
/// </summary>
/// <remarks>
/// Umbraco 17 declares <c>Name</c>, <c>CreateDate</c>, <c>UpdateDate</c>, <c>Cultures</c> and
/// <c>ItemType</c> on <see cref="IPublishedContent"/>; Umbraco 18 moved them to
/// <see cref="IPublishedElement"/>. Source compiles against both, but the compiled call names the
/// interface it was built against, so a package compiled on 17 throws
/// <see cref="MissingMethodException"/> on 18 and vice versa. Each getter is therefore located by
/// name once, on whichever interface declares it, and compiled into a delegate; after that first
/// lookup the cost is a delegate call.
/// </remarks>
internal static class PublishedContentCompat
{
    private static readonly Func<IPublishedContent, string?> NameGetter = Getter<string?>("Name");
    private static readonly Func<IPublishedContent, DateTime> CreateDateGetter = Getter<DateTime>("CreateDate");
    private static readonly Func<IPublishedContent, DateTime> UpdateDateGetter = Getter<DateTime>("UpdateDate");
    private static readonly Func<IPublishedContent, IReadOnlyDictionary<string, PublishedCultureInfo>> CulturesGetter =
        Getter<IReadOnlyDictionary<string, PublishedCultureInfo>>("Cultures");
    private static readonly Func<IPublishedContent, PublishedItemType> ItemTypeGetter = Getter<PublishedItemType>("ItemType");

    /// <summary>The document's invariant name.</summary>
    public static string? Name(IPublishedContent content) => NameGetter(content);

    /// <summary>When the document was created.</summary>
    public static DateTime CreateDate(IPublishedContent content) => CreateDateGetter(content);

    /// <summary>When the document was last saved.</summary>
    public static DateTime UpdateDate(IPublishedContent content) => UpdateDateGetter(content);

    /// <summary>The document's per-culture names and dates, keyed by culture.</summary>
    public static IReadOnlyDictionary<string, PublishedCultureInfo> Cultures(IPublishedContent content) => CulturesGetter(content);

    /// <summary>Whether the item is content or media.</summary>
    public static PublishedItemType ItemType(IPublishedContent content) => ItemTypeGetter(content);

    private static Func<IPublishedContent, T> Getter<T>(string name)
    {
        PropertyInfo property = typeof(IPublishedContent).GetProperty(name)
            ?? typeof(IPublishedElement).GetProperty(name)
            ?? throw new MissingMemberException($"Neither {nameof(IPublishedContent)} nor {nameof(IPublishedElement)} declares {name} in this Umbraco version.");

        ParameterExpression content = Expression.Parameter(typeof(IPublishedContent), "content");
        return Expression.Lambda<Func<IPublishedContent, T>>(
            Expression.Convert(Expression.Property(content, property), typeof(T)),
            content).Compile();
    }
}
