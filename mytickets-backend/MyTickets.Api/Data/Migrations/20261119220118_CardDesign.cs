using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyTickets.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CardDesign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CardDesignJson",
                table: "Organisations",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CardDesignJson",
                table: "Organisations");
        }
    }
}
