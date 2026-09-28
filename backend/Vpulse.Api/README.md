# V-PULSE API

## Configure Dataverse for local development

Store the Dataverse application credentials in .NET user secrets. They stay outside the repository.

```bash
dotnet user-secrets set "Dataverse:ConnectionString" "AuthType=ClientSecret;Url=https://org69aa2524.crm5.dynamics.com;ClientId=YOUR-APPLICATION-ID;ClientSecret=YOUR-CLIENT-SECRET;TenantId=YOUR-TENANT-ID"
```

The Entra application needs Dataverse application-user access and read permission for the `cr1da_utilitypoleriskassessment2` table. Start the API with:

```bash
dotnet run --launch-profile http
```

The frontend loads records from `GET /api/dataverse/poles`.


## Web work-form popup

The Field Team **Open Form** button loads `/api/dataverse/work-form?poleId=...`.
It uses the existing `cr1da_lvvmmodel` table and its published choice metadata.
The most recently modified matching Pole ID is edited; no match opens a new form.
The popup carries Pole ID, Feeder ID, street_name, latitude, and longitude.
Existing form values take precedence over defaults, and Pole ID stays fixed.

`PUT` to the same endpoint creates or updates the record, using the record ID and
row version returned by `GET`. Updates use optimistic concurrency so a stale
form cannot overwrite a newer Power App edit. Unchanged image values are omitted;
new JPG/PNG uploads are limited to 4 MB each. The Dataverse application user needs
create and update privileges for this table in addition to read access.

After restarting the API, the local frontend can use these endpoints. The popup
refreshes work-feedback status after a successful save. The separate embedded
Power App view is still available.
