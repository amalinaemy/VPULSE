using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Vpulse.Api.Services;

public partial class DataverseService
{
    private readonly IConfiguration _configuration;
    private readonly string? _connectionString;

    private ServiceClient? _client;
    private string? _connectionError;

    public DataverseService(IConfiguration configuration)
    {
        _configuration = configuration;

        _connectionString =
            _configuration["Dataverse:ConnectionString"];

        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            _connectionError =
                "Dataverse ConnectionString is not configured.";

            Console.WriteLine(
                "[Dataverse] Connection string is missing."
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Environment URL
    |--------------------------------------------------------------------------
    */

    public string GetEnvironmentUrl()
    {
        return _configuration["Dataverse:EnvironmentUrl"]
            ?? throw new InvalidOperationException(
                "Dataverse EnvironmentUrl is not configured."
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Connection Status
    |--------------------------------------------------------------------------
    */

    public object GetConnectionStatus()
    {
        Console.WriteLine(
            "[Dataverse] Checking connection status..."
        );

        EnsureClient();

        return new
        {
            configured =
                !string.IsNullOrWhiteSpace(_connectionString),

            environmentUrl =
                GetEnvironmentUrl(),

            connected =
                _client?.IsReady ?? false,

            authentication =
                "ServiceClient",

            message =
                _connectionError ??
                "Dataverse connection is ready."
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Utility Pole Risk Assessment
    |--------------------------------------------------------------------------
    |
    | Table:
    | cr1da_utilitypoleriskassessment2
    |
    | Retrieves ALL available Dataverse records using paging.
    |
    */

    public EntityCollection GetPoles()
    {
        Console.WriteLine(
            "[Dataverse] GetPoles started."
        );

        EnsureClient();

        if (_client is null || !_client.IsReady)
        {
            throw new InvalidOperationException(
                _connectionError ??
                _client?.LastError ??
                "Dataverse connection is not available."
            );
        }

        Console.WriteLine(
            "[Dataverse] Client ready."
        );

        /*
         * Retrieve all columns.
         *
         * This allows the frontend/detail view to use
         * all available Utility Pole Risk Assessment data.
         */

        var query = new QueryExpression(
            "cr1da_utilitypoleriskassessment2"
        )
        {
            ColumnSet = new ColumnSet(true),

            PageInfo = new PagingInfo
            {
                PageNumber = 1,
                Count = 5000
            }
        };

        /*
         * Use a stable ordering for paging.
         *
         * Do NOT order by modifiedon here because that was
         * causing the first records to appear different from
         * the expected pole list.
         */

        query.AddOrder(
            "cr1da_poleidentifier",
            OrderType.Ascending
        );

        Console.WriteLine(
            "[Dataverse] Retrieving ALL pole records..."
        );

        try
        {
            var allRecords =
                new EntityCollection();

            while (true)
            {
                Console.WriteLine(
                    $"[Dataverse] Retrieving pole page " +
                    $"{query.PageInfo.PageNumber}..."
                );

                var page =
                    _client.RetrieveMultiple(query);

                foreach (var entity in page.Entities)
                {
                    allRecords.Entities.Add(entity);
                }

                Console.WriteLine(
                    $"[Dataverse] Pole page " +
                    $"{query.PageInfo.PageNumber} returned " +
                    $"{page.Entities.Count} records."
                );

                Console.WriteLine(
                    $"[Dataverse] Total poles loaded so far: " +
                    $"{allRecords.Entities.Count}"
                );

                /*
                 * Stop when Dataverse says
                 * there are no additional pages.
                 */

                if (!page.MoreRecords)
                {
                    break;
                }

                /*
                 * Move to next Dataverse page.
                 */

                query.PageInfo.PageNumber++;

                query.PageInfo.PagingCookie =
                    page.PagingCookie;
            }

            Console.WriteLine(
                $"[Dataverse] Pole retrieval COMPLETE. " +
                $"Total records: {allRecords.Entities.Count}"
            );

            return allRecords;
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                "[Dataverse] Pole query FAILED:"
            );

            Console.WriteLine(
                ex.ToString()
            );

            throw;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Work Feedback / LV VM Model
    |--------------------------------------------------------------------------
    |
    | Table:
    | cr1da_lvvmmodel
    |
    | Retrieves ALL available work feedback records.
    |
    */

    public EntityCollection GetWorkFeedback()
    {
        Console.WriteLine(
            "[Dataverse] GetWorkFeedback started."
        );

        EnsureClient();

        if (_client is null || !_client.IsReady)
        {
            throw new InvalidOperationException(
                _connectionError ??
                _client?.LastError ??
                "Dataverse connection is not available."
            );
        }

        var query = new QueryExpression(
            "cr1da_lvvmmodel"
        )
        {
            ColumnSet = new ColumnSet(
                "cr1da_feederpolesection",
                "crf11_trimmingwork",
                "modifiedon"
            ),

            PageInfo = new PagingInfo
            {
                PageNumber = 1,
                Count = 5000
            }
        };

        query.AddOrder(
            "modifiedon",
            OrderType.Descending
        );

        Console.WriteLine(
            "[Dataverse] Retrieving ALL work feedback records..."
        );

        try
        {
            var allRecords =
                new EntityCollection();

            while (true)
            {
                Console.WriteLine(
                    $"[Dataverse] Retrieving work feedback page " +
                    $"{query.PageInfo.PageNumber}..."
                );

                var page =
                    _client.RetrieveMultiple(query);

                foreach (var entity in page.Entities)
                {
                    allRecords.Entities.Add(entity);
                }

                Console.WriteLine(
                    $"[Dataverse] Work feedback page " +
                    $"{query.PageInfo.PageNumber} returned " +
                    $"{page.Entities.Count} records."
                );

                Console.WriteLine(
                    $"[Dataverse] Total work feedback loaded so far: " +
                    $"{allRecords.Entities.Count}"
                );

                if (!page.MoreRecords)
                {
                    break;
                }

                query.PageInfo.PageNumber++;

                query.PageInfo.PagingCookie =
                    page.PagingCookie;
            }

            Console.WriteLine(
                $"[Dataverse] Work feedback retrieval COMPLETE. " +
                $"Total records: {allRecords.Entities.Count}"
            );

            return allRecords;
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                "[Dataverse] Work feedback query FAILED:"
            );

            Console.WriteLine(
                ex.ToString()
            );

            throw;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Create / Reuse Dataverse Client
    |--------------------------------------------------------------------------
    */

    private void EnsureClient()
    {
        /*
         * Reuse existing working client.
         */

        if (_client is not null &&
            _client.IsReady)
        {
            return;
        }

        /*
         * Check configuration.
         */

        if (string.IsNullOrWhiteSpace(
            _connectionString))
        {
            _connectionError =
                "Dataverse ConnectionString is not configured.";

            Console.WriteLine(
                "[Dataverse] Cannot create client: " +
                _connectionError
            );

            return;
        }

        Console.WriteLine(
            "[Dataverse] Creating ServiceClient..."
        );

        try
        {
            _client =
                new ServiceClient(
                    _connectionString
                );

            if (!_client.IsReady)
            {
                _connectionError =
                    $"Dataverse connection failed: " +
                    $"{_client.LastError}";

                Console.WriteLine(
                    "[Dataverse] " +
                    _connectionError
                );

                return;
            }

            _connectionError = null;

            Console.WriteLine(
                "[Dataverse] ServiceClient connected successfully."
            );
        }
        catch (Exception ex)
        {
            _client = null;

            _connectionError =
                $"Dataverse connection exception: " +
                $"{ex.Message}";

            Console.WriteLine(
                "[Dataverse] ServiceClient exception:"
            );

            Console.WriteLine(
                ex.ToString()
            );
        }
    }
}
