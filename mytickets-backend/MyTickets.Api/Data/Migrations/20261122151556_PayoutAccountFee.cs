using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PayoutAccountFee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccountFeeCents",
                table: "Payments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SettledAt",
                table: "Payments",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountFeeCents",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "SettledAt",
                table: "Payments");
        }
    }
}
