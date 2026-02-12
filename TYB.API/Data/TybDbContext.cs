using Microsoft.EntityFrameworkCore;

namespace TYB.API.Data;

public class TybDbContext : DbContext
{
    public TybDbContext(DbContextOptions<TybDbContext> options) : base(options)
    {
    }

    // DbContext - Raw SQL queries için kullanılır
    // Tablolar database'de zaten var, migration yok
}
