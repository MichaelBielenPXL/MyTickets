using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.PlatformMigrations
{
    /// <inheritdoc />
    public partial class OwnerTermsAccepted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TermsAcceptedAt",
                table: "OwnerAccounts",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermsVersion",
                table: "OwnerAccounts",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TermsAcceptedAt",
                table: "OwnerAccounts");

            migrationBuilder.DropColumn(
                name: "TermsVersion",
                table: "OwnerAccounts");
        }
    }
}
