using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RecordsWithoutPasswords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TermsAcceptedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TermsVersion",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "Users",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "TermsAcceptedAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermsVersion",
                table: "Users",
                type: "TEXT",
                nullable: true);
        }
    }
}
