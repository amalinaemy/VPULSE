using Microsoft.AspNetCore.Mvc;

namespace Vpulse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "OK",
            application = "V-PULSE API",
            message = "Backend is running"
        });
    }
}