using Vpulse.Api.Services;

var builder = WebApplication.CreateBuilder(args);

/*
|--------------------------------------------------------------------------
| Controllers
|--------------------------------------------------------------------------
*/

builder.Services.AddControllers();

/*
|--------------------------------------------------------------------------
| Dataverse Service
|--------------------------------------------------------------------------
*/

builder.Services.AddScoped<DataverseService>();

/*
|--------------------------------------------------------------------------
| Swagger
|--------------------------------------------------------------------------
*/

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| Allow both:
| 1. Local React development
| 2. Vercel deployed frontend
|
*/

builder.Services.AddCors(options =>
{
    options.AddPolicy("V-PULSE", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "https://vpulse-delta.vercel.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


var app = builder.Build();


/*
|--------------------------------------------------------------------------
| Swagger
|--------------------------------------------------------------------------
*/

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Must be before Authorization and MapControllers.
|
*/

app.UseCors("V-PULSE");


/*
|--------------------------------------------------------------------------
| HTTPS
|--------------------------------------------------------------------------
*/

app.UseHttpsRedirection();


/*
|--------------------------------------------------------------------------
| Authorization
|--------------------------------------------------------------------------
*/

app.UseAuthorization();


/*
|--------------------------------------------------------------------------
| Controllers
|--------------------------------------------------------------------------
*/

app.MapControllers();


app.Run();
