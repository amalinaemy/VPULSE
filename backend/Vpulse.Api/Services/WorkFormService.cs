using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using System.Text.Json;
namespace Vpulse.Api.Services;

public partial class DataverseService
{
    private static readonly object SaveLock = new();
    private static readonly Dictionary<string, string> LockedWorkFields = new()
    {
        ["cr1da_feederpolesection"] = "cr1da_poleidentifier",
        ["cr1da_feederid"] = "cr1da_feederidentifier",
        ["cr1da_zone"] = "cr1da_zone",
        ["cr1da_gpsautocapture"] = "cr1da_latitude",
        ["cr1da_gambaraireference"] = "cr1da_longitude"
    };
    const string WorkTable = "cr1da_lvvmmodel";
    public object GetWorkForm(string poleId)
    {
        var attrs = FormAttributes(); var record = FindForm(poleId);
        return new
        {
            id = record?.Id,
            version = record?.RowVersion,
            fields = attrs.Select(a => new
            {
                name = a.LogicalName,
                label = a.DisplayName.UserLocalizedLabel?.Label ?? a.LogicalName,
                type = a is ImageAttributeMetadata ? "image" : a is MultiSelectPicklistAttributeMetadata ? "multiselect" : a is EnumAttributeMetadata || a is BooleanAttributeMetadata ? "choice" : a is DateTimeAttributeMetadata ? "date" : a is DecimalAttributeMetadata || a is DoubleAttributeMetadata || a is IntegerAttributeMetadata ? "number" : "text",
                required = a.RequiredLevel?.Value is AttributeRequiredLevel.ApplicationRequired or AttributeRequiredLevel.SystemRequired,
                maxLength = (a as StringAttributeMetadata)?.MaxLength ?? (a as MemoAttributeMetadata)?.MaxLength,
                options = a is EnumAttributeMetadata e ? e.OptionSet.Options.Select(o => new { value = o.Value, label = o.Label.UserLocalizedLabel?.Label ?? o.Value.ToString() }) : a is BooleanAttributeMetadata b ? new[] { b.OptionSet.FalseOption, b.OptionSet.TrueOption }.Select(o => new { value = o.Value, label = o.Label.UserLocalizedLabel?.Label ?? o.Value.ToString() }) : null,
                value = record?.Contains(a.LogicalName) == true ? Value(record[a.LogicalName]) : null
            })
        };
    }
    public object SaveWorkForm(string poleId, WorkFormSubmission input)
    {
        lock (SaveLock) return SaveWorkFormCore(poleId, input);
    }
    AttributeMetadata[] FormAttributes()
    {
        EnsureClient();
        if (_client?.IsReady != true) throw new InvalidOperationException("Dataverse is unavailable.");
        var metadata = (RetrieveEntityResponse)_client.Execute(new RetrieveEntityRequest { LogicalName = WorkTable, EntityFilters = EntityFilters.Attributes });
        string[] names = ["cr1da_feederpolesection", "cr1da_feederid", "cr1da_zone", "cr1da_gpsautocapture", "cr1da_gambaraireference", "cr1da_inspectionstatus", "cr1da_risklevel", "cr1da_namapegawaicontractors", "cr1da_inspectiondate", "cr1da_aiconfirmedenroachment", "cr1da_gambarsemasaditapak", "crf11_gambarselepasditapak", "cr1da_fieldtrimmingrequired", "crf11_trimmingwork", "cr1da_remarksactiontaken"];
        var fields = metadata.EntityMetadata.Attributes.Where(a => a.IsValidForCreate == true && a.IsValidForUpdate == true && names.Contains(a.LogicalName)).ToArray();
        if (fields.Length != names.Length) throw new InvalidOperationException("The work form schema is incomplete.");
        return fields;
    }
    Entity? FindForm(string poleId)
    {
        var q = new QueryExpression(WorkTable) { ColumnSet = new ColumnSet(true), TopCount = 1 };
        q.Criteria.AddCondition("cr1da_feederpolesection", ConditionOperator.Equal, poleId.Trim());
        q.AddOrder("modifiedon", OrderType.Descending);
        return _client!.RetrieveMultiple(q).Entities.FirstOrDefault();
    }
    static object? Value(object? v) => v switch
    {
        OptionSetValue o => o.Value,
        OptionSetValueCollection os => os.Select(o => o.Value).ToArray(),
        DateTime d => d.ToString("yyyy-MM-dd"),
        byte[] b => "data:image/jpeg;base64," + Convert.ToBase64String(b),
        bool b => b ? 1 : 0,
        EntityReference r => r.Name,
        _ => v
    };

    private object SaveWorkFormCore(string poleId, WorkFormSubmission input)
    {
        if (string.IsNullOrWhiteSpace(poleId)) throw new ArgumentException("Pole ID is required.");
        var attrs = FormAttributes(); var existing = FindForm(poleId);
        if (existing?.Id != input.Id) throw new InvalidOperationException("The form changed. Reopen it before saving.");
        var entity = new Entity(WorkTable); if (existing != null)
        {
            if (string.IsNullOrEmpty(input.Version) || existing.RowVersion != input.Version) throw new InvalidOperationException("Someone updated this form. Reopen it to load their changes.");
            entity.Id = existing.Id; entity.RowVersion = input.Version;
        }
        // Asset identifiers and coordinates are never accepted from the submitted form.
        // Existing forms retain their asset details; new forms use the pole record.
        var editableValues = input.Values.Where(pair => !LockedWorkFields.ContainsKey(pair.Key))
            .ToDictionary(pair => pair.Key, pair => pair.Value);
        if (existing == null)
        {
            PopulateLockedAssetValues(poleId, attrs, editableValues);
        }
        foreach (var (name, v) in editableValues)
        {
            var a = attrs.SingleOrDefault(a => a.LogicalName == name) ?? throw new ArgumentException("Unknown field.");
            entity[name] = ConvertWorkFormValue(a, v);
        }
        entity["cr1da_feederpolesection"] = poleId.Trim();
        foreach (var a in attrs.Where(a => a.RequiredLevel?.Value is AttributeRequiredLevel.ApplicationRequired or AttributeRequiredLevel.SystemRequired))
        {
            var value = entity.Contains(a.LogicalName) ? entity[a.LogicalName] : existing?.GetAttributeValue<object>(a.LogicalName);
            if (value is null) throw new ArgumentException($"{a.DisplayName.UserLocalizedLabel?.Label} is required.");
        }
        if (existing == null) entity.Id = _client!.Create(entity); else _client!.Execute(new UpdateRequest { Target = entity, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
        return new { id = entity.Id };
    }
    private void PopulateLockedAssetValues(string poleId, AttributeMetadata[] attrs, Dictionary<string, JsonElement> editableValues)
    {
        var poleQuery = new QueryExpression("cr1da_utilitypoleriskassessment2")
        {
            ColumnSet = new ColumnSet(LockedWorkFields.Values.Distinct().ToArray()),
            TopCount = 2
        };
        poleQuery.Criteria.AddCondition("cr1da_poleidentifier", ConditionOperator.Equal, poleId.Trim());
        var poles = _client!.RetrieveMultiple(poleQuery).Entities;
        if (poles.Count != 1) throw new ArgumentException("A unique pole record is required to create the work form.");
        foreach (var (target, source) in LockedWorkFields)
        {
            var assetValue = poles[0].GetAttributeValue<object>(source);
            var attribute = attrs.Single(a => a.LogicalName == target);
            if (assetValue != null && attribute is StringAttributeMetadata or MemoAttributeMetadata)
                assetValue = Convert.ToString(assetValue, System.Globalization.CultureInfo.InvariantCulture);
            editableValues[target] = JsonSerializer.SerializeToElement(assetValue);
        }
    }

    private static object? ConvertWorkFormValue(AttributeMetadata a, JsonElement v)
    {
        if (v.ValueKind == JsonValueKind.Null || v.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(v.GetString())) return null;
        return a switch
        {
            ImageAttributeMetadata => ImageBytes(v.GetString()!),
            MultiSelectPicklistAttributeMetadata m => new OptionSetValueCollection(v.EnumerateArray().Select(x => Option(m, x.GetInt32())).ToList()),
            EnumAttributeMetadata e => Option(e, v.GetInt32()),
            BooleanAttributeMetadata => v.GetInt32() == 1,
            DateTimeAttributeMetadata => DateTime.Parse(v.GetString()!, System.Globalization.CultureInfo.InvariantCulture),
            DecimalAttributeMetadata => v.GetDecimal(),
            DoubleAttributeMetadata => v.GetDouble(),
            IntegerAttributeMetadata => v.GetInt32(),
            StringAttributeMetadata t when v.GetString()!.Length <= t.MaxLength => v.GetString(),
            MemoAttributeMetadata => v.GetString(),
            _ => throw new ArgumentException($"Unsupported value for {a.DisplayName.UserLocalizedLabel?.Label}.")
        };
    }

    static OptionSetValue Option(EnumAttributeMetadata a, int n) => a.OptionSet.Options.Any(o => o.Value == n) ? new(n) : throw new ArgumentException("Invalid choice.");
    static byte[] ImageBytes(string s)
    {
        if (!s.StartsWith("data:image/")) throw new ArgumentException("Invalid image.");
        var bytes = Convert.FromBase64String(s[(s.IndexOf(',') + 1)..]);
        if (bytes.Length > 4194304) throw new ArgumentException("Images must be 4 MB or smaller.");
        return bytes;
    }
}
public record WorkFormSubmission(Guid? Id, string? Version, Dictionary<string, JsonElement> Values);
