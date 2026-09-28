using Microsoft.AspNetCore.Mvc;

namespace Vpulse.Api.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult GetHealth()
    {
        return Ok(new
        {
            status = "healthy",
            application = "V-PULSE API",
            message = "V-PULSE backend is running."
        });
    }
}