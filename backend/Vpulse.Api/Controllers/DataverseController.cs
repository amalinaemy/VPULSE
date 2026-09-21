using Microsoft.AspNetCore.Mvc;
using Vpulse.Api.Services;

namespace Vpulse.Api.Controllers;

[ApiController]
[Route("api/dataverse")]
public class DataverseController : ControllerBase
{
    private readonly DataverseService _dataverseService;

    public DataverseController(DataverseService dataverseService)
    {
        _dataverseService = dataverseService;
    }

    [HttpGet("test")]
    public IActionResult Test()
    {
        return Ok(new
        {
            success = true,
            message = "V-PULSE Dataverse API endpoint is working."
        });
    }

    [HttpGet("status")]
    public IActionResult Status()
    {
        return Ok(_dataverseService.GetConnectionStatus());
    }

    [HttpGet("work-feedback")]
    public IActionResult GetWorkFeedback()
    {
        try
        {
            var records = _dataverseService.GetWorkFeedback();
            var result = records.Entities.Select(entity => new
            {
                poleId = GetValue(entity, "cr1da_feederpolesection"),
                trimmingWork = GetValue(entity, "crf11_trimmingwork", true),
                modifiedOn = GetValue(entity, "modifiedon")
            });
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to retrieve LV VM Model work feedback from Dataverse.",
                error = ex.Message
            });
        }
    }

    [HttpGet("work-form")]
    public IActionResult GetWorkForm([FromQuery] string poleId)
    {
        try { return Ok(_dataverseService.GetWorkForm(poleId)); }
        catch (Exception) { return Problem("Unable to load the Dataverse work form."); }
    }

    [HttpPut("work-form")]
    [RequestSizeLimit(16000000)]
    public IActionResult SaveWorkForm([FromQuery] string poleId, [FromBody] WorkFormSubmission input)
    {
        try { return Ok(_dataverseService.SaveWorkForm(poleId, input)); }
        catch (ArgumentException ex) { return BadRequest(new { detail = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { detail = ex.Message }); }
        catch (Exception) { return Problem("Unable to save the Dataverse work form."); }
    }

    /*HTTP REQUEST call Candidate List Table*/
    [HttpGet("poles")]
    public IActionResult GetPoles()
    {
        try
        {
            var records = _dataverseService.GetPoles();

            var result = records.Entities.Select(entity => new
            {
                poleId = entity.Contains("cr1da_poleidentifier")
                    ? entity["cr1da_poleidentifier"]
                    : null,

                feederId = entity.Contains("cr1da_feederidentifier")
                    ? entity["cr1da_feederidentifier"]
                    : null,

                streetName = entity.Contains("cr1da_zone")
                    ? entity["cr1da_zone"]
                    : null,

                zone = GetValue(entity, "crf11_zone_name"),
                state = GetValue(entity, "crf11_state"),
                station = GetValue(entity, "crf11_station", true)?.ToString(),

                latitude = entity.Contains("cr1da_latitude")
                    ? entity["cr1da_latitude"]
                    : null,

                longitude = entity.Contains("cr1da_longitude")
                    ? entity["cr1da_longitude"]
                    : null,

                finalAiRiskScore = entity.Contains("cr1da_risknumericvalue")
                    ? entity["cr1da_risknumericvalue"]
                    : null,

                finalAiRiskCategory = entity.FormattedValues.TryGetValue(
                    "cr1da_finalairiskcategory", out var riskCategory)
                    ? riskCategory
                    : entity.Contains("cr1da_finalairiskcategory")
                        ? entity["cr1da_finalairiskcategory"]
                        : null,

                landCoverType = entity.FormattedValues.TryGetValue(
                    "cr1da_landcovertype", out var landCoverType)
                    ? landCoverType
                    : entity.Contains("cr1da_landcovertype")
                        ? entity["cr1da_landcovertype"]
                        : null,

                rvi = GetValue(entity, "cr1da_relativevegetationindex"),
                ndvi = GetValue(entity, "cr1da_normalizeddifferencevegetationind"),
                vegetationDensity = GetValue(entity, "cr1da_vegetationdensity", true),
                cloudScore = GetValue(entity, "cr1da_cloudscore"),
                rviTrend3m = GetValue(entity, "cr1da_rvitrend3months", true),
                ndviTrend3m = GetValue(entity, "cr1da_ndvitrend3months", true),
                action = GetValue(entity, "cr1da_recommendedaction", true),
                riskReason = GetValue(entity, "cr1da_riskreason"),
                lineType = GetValue(entity, "cr1da_linetype", true),
                lastPruneDate = GetValue(entity, "cr1da_lastprunedate"),
                outageCount12m = GetValue(entity, "cr1da_outagecount12months"),
                operationalRiskCategory = GetValue(entity, "cr1da_operationalriskcategory", true),
                aiRiskGroup = GetValue(entity, "cr1da_airiskgroup", true),
                aiRiskScore = GetValue(entity, "cr1da_airiskscore"),
                workOrderStatus = GetValue(entity, "cr1da_workorderstatus", true),
                aiValidation = GetValue(entity, "cr1da_aivalidation", true),
                modifiedOn = GetValue(entity, "modifiedon")
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                message = "Failed to retrieve pole data from Dataverse.",
                error = ex.Message
            });
        }
    }

    private static object? GetValue(
        Microsoft.Xrm.Sdk.Entity entity,
        string attributeName,
        bool preferFormattedValue = false)
    {
        if (preferFormattedValue &&
            entity.FormattedValues.TryGetValue(attributeName, out var formattedValue))
        {
            return formattedValue;
        }

        if (!entity.Attributes.TryGetValue(attributeName, out var value))
        {
            return null;
        }

        return value switch
        {
            Microsoft.Xrm.Sdk.OptionSetValue option => option.Value,
            Microsoft.Xrm.Sdk.Money money => money.Value,
            Microsoft.Xrm.Sdk.EntityReference reference => reference.Name ?? reference.Id.ToString(),
            _ => value
        };
    }
}
