using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Outbox : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Outbox",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Data = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Attempts = table.Column<int>(type: "INTEGER", nullable: false),
                    LastError = table.Column<string>(type: "TEXT", nullable: true),
                    ProcessedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Outbox", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Outbox_ProcessedAt_NextAttemptAt",
                table: "Outbox",
                columns: new[] { "ProcessedAt", "NextAttemptAt" });

            // Payments paid before the outbox whose money was never recorded as passed on: their event, due now.
            // (Those Stripe had already paid straight to the organisation are recognised as such when handled.)
            migrationBuilder.Sql("""
                INSERT INTO Outbox (Id, Type, Data, CreatedAt, NextAttemptAt, Attempts, LastError, ProcessedAt)
                SELECT Id, 'PaymentCompleted', '{"PaymentId":"' || Id || '"}', CompletedAt, CompletedAt, 0, NULL, NULL
                FROM Payments
                WHERE Status = 'Paid' AND Provider = 'Stripe' AND TransferId IS NULL AND CompletedAt IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Outbox");
        }
    }
}
