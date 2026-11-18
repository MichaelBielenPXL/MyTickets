using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MembershipEndDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DurationDays",
                table: "MembershipTiers");

            migrationBuilder.AddColumn<DateOnly>(
                name: "EndsOn",
                table: "MembershipTiers",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndsOn",
                table: "MembershipTiers");

            migrationBuilder.AddColumn<int>(
                name: "DurationDays",
                table: "MembershipTiers",
                type: "INTEGER",
                nullable: true);
        }
    }
}
