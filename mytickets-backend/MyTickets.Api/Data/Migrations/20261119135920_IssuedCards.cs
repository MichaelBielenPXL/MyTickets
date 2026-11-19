using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class IssuedCards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Cards become issued by the organisation and linked to a wallet instead of a user.
            migrationBuilder.AddColumn<bool>(name: "ExtraCardAllowed", table: "Wallets", type: "INTEGER", nullable: false, defaultValue: false);

            migrationBuilder.AddColumn<int>(name: "Number", table: "NfcCards", type: "INTEGER", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<string>(name: "Code", table: "NfcCards", type: "TEXT", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "WalletId", table: "NfcCards", type: "TEXT", nullable: true);
            migrationBuilder.AddColumn<bool>(name: "Locked", table: "NfcCards", type: "INTEGER", nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<DateTime>(name: "CreatedAt", table: "NfcCards", type: "TEXT", nullable: false, defaultValue: new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
            migrationBuilder.AddColumn<DateTime>(name: "WrittenAt", table: "NfcCards", type: "TEXT", nullable: true);

            // Every card linked so far keeps working: it gets a number in the order it was linked, and is attached to
            // its owner's wallet here (made with nothing on it when the owner never had one).
            migrationBuilder.Sql("""
                INSERT INTO "Wallets" ("Id", "UserId", "OrganisationId", "BalanceCents", "ExtraCardAllowed")
                SELECT upper(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-A' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
                       c."UserId", (SELECT "Id" FROM "Organisations" LIMIT 1), 0, 0
                FROM (SELECT DISTINCT "UserId" FROM "NfcCards") c
                WHERE NOT EXISTS (SELECT 1 FROM "Wallets" w WHERE w."UserId" = c."UserId")
                  AND EXISTS (SELECT 1 FROM "Organisations");
                """);
            migrationBuilder.Sql("""
                UPDATE "NfcCards" SET
                    "Number" = (SELECT COUNT(*) FROM "NfcCards" o WHERE o."LinkedAt" < "NfcCards"."LinkedAt"
                                OR (o."LinkedAt" = "NfcCards"."LinkedAt" AND o."Id" <= "NfcCards"."Id")),
                    "WalletId" = (SELECT w."Id" FROM "Wallets" w WHERE w."UserId" = "NfcCards"."UserId" LIMIT 1),
                    "CreatedAt" = "LinkedAt",
                    "WrittenAt" = "LinkedAt";
                """);

            migrationBuilder.DropForeignKey(name: "FK_NfcCards_Users_UserId", table: "NfcCards");
            migrationBuilder.DropIndex(name: "IX_NfcCards_Uid", table: "NfcCards");
            migrationBuilder.DropIndex(name: "IX_NfcCards_UserId", table: "NfcCards");
            migrationBuilder.DropColumn(name: "UserId", table: "NfcCards");

            migrationBuilder.AlterColumn<string>(name: "Uid", table: "NfcCards", type: "TEXT", nullable: true, oldClrType: typeof(string), oldType: "TEXT");
            migrationBuilder.AlterColumn<DateTime>(name: "LinkedAt", table: "NfcCards", type: "TEXT", nullable: true, oldClrType: typeof(DateTime), oldType: "TEXT");

            migrationBuilder.CreateIndex(name: "IX_NfcCards_Code", table: "NfcCards", column: "Code", unique: true, filter: "\"Code\" IS NOT NULL");
            migrationBuilder.CreateIndex(name: "IX_NfcCards_Number", table: "NfcCards", column: "Number", unique: true);
            migrationBuilder.CreateIndex(name: "IX_NfcCards_Uid", table: "NfcCards", column: "Uid", unique: true, filter: "\"Uid\" IS NOT NULL");
            migrationBuilder.CreateIndex(name: "IX_NfcCards_WalletId", table: "NfcCards", column: "WalletId");
            migrationBuilder.AddForeignKey(name: "FK_NfcCards_Wallets_WalletId", table: "NfcCards", column: "WalletId",
                principalTable: "Wallets", principalColumn: "Id", onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            throw new NotSupportedException("Issued cards can't be turned back into cards owned by a user.");
    }
}
