using System.Text.Json;
using System.Text.RegularExpressions;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>Whether an organisation asks for a detail: not at all, if people want to give it, or always.</summary>
public enum FieldMode { Off, Optional, Required }

/// <summary>
/// The details asked when someone chooses a membership. First and last name are always asked; each
/// organisation decides about the rest (a club that isn't for students switches school and faculty off).
/// </summary>
public static partial class ProfileFields
{
    public const string Phone = "phone", Address = "address", School = "school", Faculty = "faculty", StudyYear = "studyYear";
    public static readonly string[] Configurable = [Phone, Address, School, Faculty, StudyYear];

    public static Dictionary<string, FieldMode> Defaults() => Configurable.ToDictionary(f => f, _ => FieldMode.Optional);

    public static Dictionary<string, FieldMode> Read(Organisation organisation)
    {
        var modes = Defaults();
        if (string.IsNullOrWhiteSpace(organisation.ProfileFieldsJson)) return modes;
        try
        {
            var saved = JsonSerializer.Deserialize<Dictionary<string, FieldMode>>(organisation.ProfileFieldsJson) ?? [];
            foreach (var (field, mode) in saved)
                if (modes.ContainsKey(field)) modes[field] = mode;
        }
        catch (JsonException) { }
        return modes;
    }

    public static string Write(Dictionary<string, FieldMode> modes) =>
        JsonSerializer.Serialize(Configurable.ToDictionary(f => f, f => modes.GetValueOrDefault(f, FieldMode.Optional)));

    public record Values(string? FirstName, string? LastName, string? Phone, string? Street, string? PostalCode, string? City,
        string? School, string? Faculty, string? StudyYear);

    /// <summary>The same details with the ones this organisation doesn't ask left out.</summary>
    public static Values OnlyAsked(Values v, Dictionary<string, FieldMode> modes)
    {
        string? IfAsked(string field, string? value) => modes.GetValueOrDefault(field) == FieldMode.Off ? null : value;
        return v with
        {
            Phone = IfAsked(Phone, v.Phone), Street = IfAsked(Address, v.Street), PostalCode = IfAsked(Address, v.PostalCode),
            City = IfAsked(Address, v.City), School = IfAsked(School, v.School), Faculty = IfAsked(Faculty, v.Faculty),
            StudyYear = IfAsked(StudyYear, v.StudyYear),
        };
    }

    /// <summary>Nothing filled in yet.</summary>
    public static readonly Values Empty = new(null, null, null, null, null, null, null, null, null);

    public static Values Of(User user) =>
        new(user.FirstName, user.LastName, user.Phone, user.Street, user.PostalCode, user.City, user.School, user.Faculty, user.StudyYear);

    /// <summary>Whether everything this organisation requires has been given.</summary>
    public static bool IsComplete(User user, Dictionary<string, FieldMode> modes) => Problem(Of(user), modes) is null;

    /// <summary>The first thing wrong with these details, in words a member can act on; null when all is well.</summary>
    public static string? Problem(Values v, Dictionary<string, FieldMode> modes)
    {
        bool Required(string field) => modes.GetValueOrDefault(field) == FieldMode.Required;
        bool Missing(string? value) => string.IsNullOrWhiteSpace(value);

        if (Missing(v.FirstName) || Missing(v.LastName)) return "Enter your first and last name.";
        if (v.FirstName!.Trim().Length > 80 || v.LastName!.Trim().Length > 80) return "Your name is too long.";
        if (Required(Phone) && Missing(v.Phone)) return "Enter your phone number.";
        if (!Missing(v.Phone) && !PhoneFormat().IsMatch(v.Phone!.Trim())) return "That doesn't look like a phone number.";
        if (Required(Address) && (Missing(v.Street) || Missing(v.PostalCode) || Missing(v.City))) return "Enter your address: street, postal code and city.";
        if (Required(School) && Missing(v.School)) return "Enter your school.";
        if (Required(Faculty) && Missing(v.Faculty)) return "Enter your faculty.";
        if (Required(StudyYear) && Missing(v.StudyYear)) return "Enter your year.";
        foreach (var value in new[] { v.Street, v.City, v.School, v.Faculty, v.StudyYear, v.PostalCode })
            if (value is { Length: > 120 }) return "One of the answers is too long.";
        return null;
    }

    /// <summary>Saves the details, leaving out what this organisation doesn't ask, and names the account after the person.</summary>
    public static void Apply(User user, Values v, Dictionary<string, FieldMode> modes, DateTime now)
    {
        string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        string? IfAsked(string field, string? value) => modes.GetValueOrDefault(field) == FieldMode.Off ? null : Clean(value);

        user.FirstName = Clean(v.FirstName);
        user.LastName = Clean(v.LastName);
        user.Phone = IfAsked(Phone, v.Phone);
        user.Street = IfAsked(Address, v.Street);
        user.PostalCode = IfAsked(Address, v.PostalCode);
        user.City = IfAsked(Address, v.City);
        user.School = IfAsked(School, v.School);
        user.Faculty = IfAsked(Faculty, v.Faculty);
        user.StudyYear = IfAsked(StudyYear, v.StudyYear);
        user.DisplayName = $"{user.FirstName} {user.LastName}";
        user.ProfileUpdatedAt = now;
    }

    [GeneratedRegex(@"^\+?[0-9 ()/.\-]{6,24}$")]
    private static partial Regex PhoneFormat();
}
