namespace MyTickets.Api.Data;

/// <summary>The jobs at an event, each opened up to some roles.</summary>
public enum StaffTask { Bar, Door, CashTopUp, CheckCard, MemberInfo }

public static class StaffTasks
{
    /// <summary>
    /// Barmen work the bar, doormen the door; staff and admins do everything. All of them can check a card;
    /// only staff and admins look up members' details and history.
    /// </summary>
    public static bool Can(OrgRole role, StaffTask task) => task switch
    {
        StaffTask.Bar => role is OrgRole.Barman or OrgRole.Staff or OrgRole.Admin,
        StaffTask.Door => role is OrgRole.Doorman or OrgRole.Staff or OrgRole.Admin,
        StaffTask.CashTopUp => role is OrgRole.Staff or OrgRole.Admin,
        StaffTask.CheckCard => role is not OrgRole.Member,
        StaffTask.MemberInfo => role is OrgRole.Staff or OrgRole.Admin,
        _ => false,
    };

    public static IEnumerable<StaffTask> For(OrgRole role) => Enum.GetValues<StaffTask>().Where(t => Can(role, t));
}
