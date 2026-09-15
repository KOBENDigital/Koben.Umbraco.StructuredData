using Koben.Umbraco.StructuredData.Persistence;
using Koben.Umbraco.StructuredData.Rules;
using Koben.Umbraco.StructuredData.ViewModels;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Koben.Umbraco.StructuredData.Controllers;

/// <summary>CRUD over generation rules.</summary>
public sealed class RulesController(IStructuredDataRuleRepository repository) : StructuredDataControllerBase
{
    /// <summary>Lists every rule in evaluation order.</summary>
    [HttpGet("rules")]
    [ProducesResponseType(typeof(IEnumerable<StructuredDataRuleModel>), StatusCodes.Status200OK)]
    public IActionResult GetAll() => Ok(repository.GetAll().Select(StructuredDataRuleModel.FromRule));

    /// <summary>Reads one rule.</summary>
    [HttpGet("rules/{key:guid}")]
    [ProducesResponseType(typeof(StructuredDataRuleModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult Get(Guid key)
    {
        StructuredDataRule? rule = repository.Get(key);
        return rule is null ? NotFoundProblem(key) : Ok(StructuredDataRuleModel.FromRule(rule));
    }

    /// <summary>Creates a rule.</summary>
    [HttpPost("rules")]
    [ProducesResponseType(typeof(StructuredDataRuleModel), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public IActionResult Create([FromBody] StructuredDataRuleModel model)
    {
        if (model.Validate() is { } problem)
        {
            return InvalidProblem(problem);
        }

        model.Key = null;
        StructuredDataRule rule = model.ToRule();
        repository.Save(rule);
        StructuredDataRuleModel created = StructuredDataRuleModel.FromRule(rule);
        return CreatedAtAction(nameof(Get), new { key = rule.Key }, created);
    }

    /// <summary>Updates a rule.</summary>
    [HttpPut("rules/{key:guid}")]
    [ProducesResponseType(typeof(StructuredDataRuleModel), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult Update(Guid key, [FromBody] StructuredDataRuleModel model)
    {
        if (repository.Get(key) is null)
        {
            return NotFoundProblem(key);
        }

        if (model.Validate() is { } problem)
        {
            return InvalidProblem(problem);
        }

        model.Key = key;
        StructuredDataRule rule = model.ToRule();
        repository.Save(rule);
        return Ok(StructuredDataRuleModel.FromRule(rule));
    }

    /// <summary>Deletes a rule.</summary>
    [HttpDelete("rules/{key:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public IActionResult Delete(Guid key) => repository.Delete(key) ? Ok() : NotFoundProblem(key);

    /// <summary>Exports every rule in the seed file format.</summary>
    [HttpGet("rules/export")]
    [ProducesResponseType(typeof(StructuredDataRulesExportModel), StatusCodes.Status200OK)]
    public IActionResult Export() => Ok(new StructuredDataRulesExportModel
    {
        Rules = repository.GetAll().Select(StructuredDataRuleModel.FromRule).ToList(),
    });

    /// <summary>Imports rules from the seed file format, replacing or upserting by key.</summary>
    [HttpPost("rules/import")]
    [ProducesResponseType(typeof(IEnumerable<StructuredDataRuleModel>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public IActionResult Import([FromBody] StructuredDataRulesImportRequestModel request)
    {
        foreach (StructuredDataRuleModel model in request.Rules)
        {
            if (model.Validate() is { } problem)
            {
                return InvalidProblem($"{model.Name}: {problem}");
            }
        }

        List<StructuredDataRule> rules = request.Rules.Select(model => model.ToRule()).ToList();
        if (request.Replace)
        {
            repository.ReplaceAll(rules);
        }
        else
        {
            foreach (StructuredDataRule rule in rules)
            {
                repository.Save(rule);
            }
        }

        return Ok(repository.GetAll().Select(StructuredDataRuleModel.FromRule));
    }

    private IActionResult InvalidProblem(string detail) => Problem(
        detail: detail,
        title: "Invalid rule",
        statusCode: StatusCodes.Status400BadRequest,
        type: InvalidRuleProblem);

    private IActionResult NotFoundProblem(Guid key) => Problem(
        detail: $"No rule has the key {key}.",
        title: "Rule not found",
        statusCode: StatusCodes.Status404NotFound,
        type: RuleNotFoundProblem);
}
