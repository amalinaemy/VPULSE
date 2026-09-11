using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Vpulse.Api.Services;

public class DataverseService
{
    private readonly IConfiguration _configuration;
    private readonly string? _connectionString;
    private ServiceClient? _client;
    private string? _connectionError;

    public DataverseService(IConfiguration configuration)
    {
        _configuration = configuration;

        _connectionString = _configuration["Dataverse:ConnectionString"];

        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            _connectionError = "Dataverse ConnectionString is not configured.";
        }
    }

    public string GetEnvironmentUrl()
    {
        return _configuration["Dataverse:EnvironmentUrl"]
            ?? throw new InvalidOperationException(
                "Dataverse EnvironmentUrl is not configured.");
    }

    public object GetConnectionStatus()
    {
        EnsureClient();

        return new
        {
            configured = _client is not null,
            environmentUrl = GetEnvironmentUrl(),
            connected = _client?.IsReady ?? false,
            authentication = "ServiceClient",
            message = _connectionError ?? "Dataverse connection is ready."
        };
    }

    public EntityCollection GetPoles()
    {
        EnsureClient();

        if (_client is null || !_client.IsReady)
        {
            throw new InvalidOperationException(
                _connectionError ?? "Dataverse connection is not available.");
        }

        var query = new QueryExpression(
            "cr1da_utilitypoleriskassessment2"
        )
        {
            // The detail modal needs the full Dataverse assessment record.  This also
            // avoids coupling the UI to a single publisher-prefix naming convention.
            ColumnSet = new ColumnSet(true)
        };

        return _client.RetrieveMultiple(query);
    }

    public EntityCollection GetWorkFeedback()
    {
        EnsureClient();
        if (_client is null || !_client.IsReady)
            throw new InvalidOperationException(_connectionError ?? "Dataverse connection is not available.");

        var query = new QueryExpression("cr1da_lvvmmodel")
        {
            ColumnSet = new ColumnSet("cr1da_feederpolesection", "crf11_trimmingwork", "modifiedon")
        };
        query.AddOrder("modifiedon", OrderType.Descending);
        return _client.RetrieveMultiple(query);
    }

    private void EnsureClient()
    {
        if (_client is not null || string.IsNullOrWhiteSpace(_connectionString))
        {
            return;
        }

        _client = new ServiceClient(_connectionString);

        if (!_client.IsReady)
        {
            _connectionError = $"Dataverse connection failed: {_client.LastError}";
        }
    }
}
