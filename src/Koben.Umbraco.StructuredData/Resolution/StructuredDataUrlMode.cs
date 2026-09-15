namespace Koben.Umbraco.StructuredData.Resolution;

/// <summary>
/// Which URL space resolved references are written in.
/// </summary>
public enum StructuredDataUrlMode
{
    /// <summary>Absolute URLs from the site's own URL providers, for Razor-rendered pages.</summary>
    Website,

    /// <summary>
    /// The Delivery API's paths: a document becomes its route path and media its Delivery API URL,
    /// so a headless frontend makes them absolute against its own origin.
    /// </summary>
    DeliveryApi,
}
