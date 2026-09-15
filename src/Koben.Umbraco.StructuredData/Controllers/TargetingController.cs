using Koben.Umbraco.StructuredData.ViewModels;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Services;

namespace Koben.Umbraco.StructuredData.Controllers;

/// <summary>What a rule can be targeted at: site roots (with their hostnames) and languages.</summary>
public sealed class TargetingController(IContentService contentService, IDomainService domainService, ILanguageService languageService) : StructuredDataControllerBase
{
    /// <summary>Root documents with the hostnames assigned to them.</summary>
    [HttpGet("sites")]
    [ProducesResponseType(typeof(IEnumerable<StructuredDataSiteModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSites()
    {
        var sites = new List<StructuredDataSiteModel>();
        foreach (IContent root in contentService.GetRootContent().OrderBy(root => root.SortOrder))
        {
            IEnumerable<IDomain> domains = await domainService.GetAssignedDomainsAsync(root.Key, includeWildcards: true);
            sites.Add(new StructuredDataSiteModel
            {
                Key = root.Key,
                Name = root.Name ?? root.Key.ToString(),
                Domains = domains.Select(domain => new StructuredDataDomainModel { DomainName = domain.DomainName, Culture = domain.LanguageIsoCode }).ToList(),
            });
        }

        return Ok(sites);
    }

    /// <summary>Configured languages.</summary>
    [HttpGet("cultures")]
    [ProducesResponseType(typeof(IEnumerable<StructuredDataCultureModel>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCultures()
    {
        IEnumerable<ILanguage> languages = await languageService.GetAllAsync();
        return Ok(languages.Select(language => new StructuredDataCultureModel
        {
            IsoCode = language.IsoCode,
            Name = language.CultureName,
            IsDefault = language.IsDefault,
        }));
    }
}
