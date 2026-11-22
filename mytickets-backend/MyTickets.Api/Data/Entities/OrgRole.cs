namespace MyTickets.Api.Data;

/// <summary>
/// Stored by name, so roles can be added anywhere. Everyone from Barman up works at the event; what each
/// may do there is in <see cref="StaffTasks"/>. Only admins manage the organisation.
/// </summary>
public enum OrgRole { Member, Barman, Doorman, Staff, Admin }
