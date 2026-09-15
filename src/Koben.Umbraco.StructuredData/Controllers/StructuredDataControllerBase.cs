using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Management.Controllers;
using Umbraco.Cms.Api.Management.Routing;
using Umbraco.Cms.Web.Common.Authorization;

namespace Koben.Umbraco.StructuredData.Controllers;

/// <summary>
/// Shared route, OpenAPI grouping and authorization for the package's Management API. Rules shape
/// what every page emits, so they sit behind the Settings section like other schema-level tools.
/// </summary>
[VersionedApiBackOfficeRoute("structured-data")]
[ApiExplorerSettings(GroupName = "Structured Data")]
[Authorize(Policy = AuthorizationPolicies.SectionAccessSettings)]
public abstract class StructuredDataControllerBase : ManagementApiControllerBase
{
    /// <summary>The problem type for a rule that cannot be stored as sent.</summary>
    protected const string InvalidRuleProblem = "urn:koben:structured-data:invalid-rule";

    /// <summary>The problem type for a missing rule.</summary>
    protected const string RuleNotFoundProblem = "urn:koben:structured-data:rule-not-found";

    /// <summary>The problem type for a document the preview cannot find.</summary>
    protected const string DocumentNotFoundProblem = "urn:koben:structured-data:document-not-found";
}
