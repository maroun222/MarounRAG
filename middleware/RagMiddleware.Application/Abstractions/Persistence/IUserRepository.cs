using RagMiddleware.Domain.Entities;

namespace RagMiddleware.Application.Abstractions.Persistence;

public interface IUserRepository
{
    Task<ApplicationUser> UpsertGoogleUserAsync(
        ApplicationUser user,
        CancellationToken cancellationToken = default
    );
}