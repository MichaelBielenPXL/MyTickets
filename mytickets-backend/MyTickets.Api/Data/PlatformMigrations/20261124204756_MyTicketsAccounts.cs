using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.PlatformMigrations
{
    /// <inheritdoc />
    public partial class MyTicketsAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Everyone's MyTickets account. Organiser logins become accounts as they are: same id, same password.
            migrationBuilder.CreateTable(
                name: "Accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TermsAcceptedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    TermsVersion = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table => table.PrimaryKey("PK_Accounts", x => x.Id));
            migrationBuilder.Sql("""
                INSERT INTO Accounts (Id, Email, DisplayName, PasswordHash, CreatedAt, TermsAcceptedAt, TermsVersion)
                SELECT Id, Email, DisplayName, PasswordHash, CreatedAt, TermsAcceptedAt, TermsVersion FROM OwnerAccounts;
                """);
            migrationBuilder.CreateIndex(name: "IX_Accounts_Email", table: "Accounts", column: "Email", unique: true);

            // Which record at which organisation belongs to which account. An organiser's admin records come first;
            // everyone else's are linked at start-up (see AccountMerge), which can read the organisations' databases.
            migrationBuilder.CreateTable(
                name: "AccountLinks",
                columns: table => new
                {
                    AccountId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TenantId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_AccountLinks", x => new { x.AccountId, x.TenantId }));
            migrationBuilder.Sql("""
                INSERT INTO AccountLinks (AccountId, TenantId, UserId, CreatedAt)
                SELECT o.OwnerAccountId, o.TenantId, o.UserId, t.CreatedAt FROM TenantOwners o JOIN Tenants t ON t.Id = o.TenantId;
                """);
            migrationBuilder.CreateIndex(name: "IX_AccountLinks_TenantId", table: "AccountLinks", column: "TenantId");

            // Who owns which organisation: the account, now that the admin record is in AccountLinks.
            migrationBuilder.Sql("""
                CREATE TABLE TenantOwnersNew (TenantId TEXT NOT NULL, AccountId TEXT NOT NULL, CONSTRAINT PK_TenantOwners PRIMARY KEY (TenantId, AccountId));
                INSERT INTO TenantOwnersNew (TenantId, AccountId) SELECT TenantId, OwnerAccountId FROM TenantOwners;
                DROP TABLE TenantOwners;
                ALTER TABLE TenantOwnersNew RENAME TO TenantOwners;
                """);
            migrationBuilder.CreateIndex(name: "IX_TenantOwners_AccountId", table: "TenantOwners", column: "AccountId");

            migrationBuilder.DropTable(name: "OwnerAccounts");
            migrationBuilder.DropTable(name: "AccountIndex");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            throw new NotSupportedException("MyTickets accounts can't be split back into separate logins per organisation.");
    }
}
