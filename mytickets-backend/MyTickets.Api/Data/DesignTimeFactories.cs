using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MyTickets.Api.Data;

/// <summary>Lets the migration tools build an organisation database without a web request to say which one.</summary>
public class AppDbContextDesignFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=design-time.db").Options);
}

public class PlatformDbContextDesignFactory : IDesignTimeDbContextFactory<PlatformDbContext>
{
    public PlatformDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<PlatformDbContext>().UseSqlite("Data Source=design-time-platform.db").Options);
}
